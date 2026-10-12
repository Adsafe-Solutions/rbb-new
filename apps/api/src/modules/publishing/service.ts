import { createHash, randomUUID } from "node:crypto";
import {
  GET_INVOLVED_PAGE_IDS,
  POLICY_IDS,
  PublishedSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  appealMediaIds,
  donationPageMediaIds,
  homepageMediaIds,
  aboutMediaIds,
  impactMediaIds,
  projectMediaIds,
  type About,
  type Careers,
  type Policy,
  type PolicyId,
  type GetInvolvedPage,
  type GetInvolvedPageId,
  type AnnouncementBar,
  type Popup,
  type StoryStrip,
  type Impact,
  type Metric,
  type Program,
  type Project,
  type Report,
  type Transparency,
  type TeamMember,
  recordMediaIds,
  settingsMediaIds,
  snapshotMediaIds,
  type Appeal,
  type Event,
  type Post,
  type PublishedMedia,
  type SiteSettings,
  type SnapshotContent,
} from "@rbb/content-schema";
import type { DonationPageStore } from "../donation-page/repository.ts";
import type { HomepageStore } from "../homepage/repository.ts";
import type { BlockPageStore } from "../pages/repository.ts";
import type { CheckoutReference, CheckoutVerifier } from "../donations/verify.ts";
import type { ContentRecordBase, ContentStore, StoredContent } from "../content/repository.ts";
import { isLive } from "../content/shared.ts";
import { ApiError, errors, type ErrorDetail } from "../../errors.ts";
import { SENSITIVE_KEY, redactText, type Logger } from "../../logging/logger.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { can } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";
import type { MediaStore } from "../media/repository.ts";
import type { SettingsStore } from "../settings/repository.ts";
import { SECTIONS } from "../settings/service.ts";
import type { DeploymentOutcome, DeploymentTrigger } from "./deploy.ts";
import type { DeploymentState, PublishStore, StoredSnapshot } from "./repository.ts";
import { canonical, fingerprintOf } from "./schedule.ts";
import { POLICY_LABELS as POLICY_SECTIONS, policyWorkingTextProblems } from "../policies/service.ts";
import { GET_INVOLVED_LABELS } from "../get-involved/service.ts";
import { LOCK_TTL_MS, PUBLISH_BUSY } from "./lock.ts";

/* Publishing: the working copy → an immutable, versioned public snapshot.

   A publish (OWNER only: publish:execute) runs, under a lock so two cannot
   interleave:
     1. load the working settings (this organization's)
     2. build the candidate: settings as PUBLISHED, plus exactly the media
        they reference — each must be ready media of this organization
     3. validate the whole candidate against the content contract
        (PublishedSnapshot), and scan it for anything secret-shaped
     4. take the next version number
     5. store the snapshot (immutable)
     6. move the public pointer to it — one document update
     7. audit, then tell the deployment trigger (if any)
   Any failure before step 6 leaves the public on the previous snapshot;
   nothing partial is ever visible.

   M14 — WHAT a publish takes (the editorial workflow, content/workflow.ts):
   a record or page enters with its current revision only when that
   revision is APPROVED (or already published). One that has been changed
   since it was published (a draft or submitted revision) keeps its
   PUBLISHED version: carried forward, as it is, from the live snapshot —
   so an edit is never public until approved and published. Never-approved
   drafts, submitted revisions and archived records are left out. After the
   pointer moves, what went live is marked: approved → published.

   M15 — WHEN: an approved revision with a SCHEDULE (publishing/schedule.ts)
   joins a publish only once its time has come, and only while its content
   is still exactly what was scheduled (the fingerprint); until then it is
   held back like an unapproved edit (its live version, if any, stays). A
   publish — the owner's, or the scheduler's (runScheduled: one central
   run for every content type, triggered from outside: a cron calling the
   internal scheduler route, or the scheduler CLI) — takes everything that
   is approved and due, under the same lock, through the same pipeline.
   The deployment trigger's outcome is kept with the active version: a run
   that stopped after the public moved is finished (marks, trigger, audit)
   by the next one, and a failed trigger is retried by the scheduler, a
   bounded number of times. */


/* M15: a deployment trigger that failed is tried again by the scheduler,
   up to this many attempts in all for one version. */
export const MAX_DEPLOY_ATTEMPTS = 3;
const NO_CHANGES = "There are no unpublished changes.";
/* Who a scheduled publication is published by. */
const SCHEDULER = { id: "scheduler", name: "Scheduled publication" } as const;



/* M14: a record published for the first time is dated by the publish
   that takes it. Until then it carries this placeholder, so what would be
   published hashes the same from one moment to the next (the review's
   changesKey); the snapshot itself is stamped with the real date. Once
   every record has its date, the two hashes are one. */
const FIRST_PUBLISH = "(first publish)";
function stamp(content: SnapshotContent, at: string): SnapshotContent {
  const dated = <T>(r: T): T => ((r as { publishedAt?: string } | null)?.publishedAt === FIRST_PUBLISH ? { ...r, publishedAt: at } : r);
  return Object.fromEntries(Object.entries(content).map(([k, v]) => [k, Array.isArray(v) ? v.map(dated) : dated(v)])) as SnapshotContent;
}

export function contentHash(record: SiteSettings, collections: SnapshotContent = {}, framing: Framing = {}): string {
  const { id: _i, orgId: _o, schemaVersion: _s, status: _st, createdAt: _c, updatedAt: _u, publishedAt: _p, releaseMarker: _r, ...settings } = record;
  // Settings alone hash exactly as they did before content existed.
  const source = Object.keys(collections).length ? { settings, content: collections } : settings;
  /* Milestone 2: an image's focal point or caption is part of what goes
     live, so changing one is a change to publish. Only images that have
     one are hashed — every hash made before Milestone 2 stays the same. */
  return createHash("sha256").update(canonical(Object.keys(framing).length ? { source, framing } : source)).digest("hex");
}

/* Milestone 2: the focal point and caption of each image a publish uses,
   for the images that have either. */
export type Framing = Record<string, { focal?: string; caption?: string }>;

/* A record as it appears in a snapshot: the contract record without its
   editing timestamps (publishedAt stays). */
const forSnapshot = <R extends { createdAt?: string; updatedAt?: string }>({ createdAt: _c, updatedAt: _u, ...record }: R) => record;

/* Collections (arrays of records) and single pages in `content`. */
export const COLLECTION_KEYS = ["news", "blogs", "events", "appeals", "team", "programs", "metrics", "reports", "stories", "projects"] as const;
export const CONTENT_KEYS = [...COLLECTION_KEYS, "generalDonation", "homepage", "about", "impact", "transparency", "careers", "policies", "getInvolved", "announcementBar", "popup", "storyStrip"] as const;

/* Defence in depth on top of the strict contract: no key that names a
   credential, and no value that looks like one, anywhere in a snapshot. */
export function secretProblems(value: unknown, path = "snapshot"): string[] {
  if (typeof value === "string") return redactText(value) !== value ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => secretProblems(v, `${path}.${i}`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => (SENSITIVE_KEY.test(k) ? [`${path}.${k}`] : secretProblems(v, `${path}.${k}`)));
  return [];
}

/* M36: what the next publish would put live, for an owner's LOCAL
   preview of the website (apps/web `npm run preview:cms`). Never stored:
   `snapshot` is null while anything would block a publish. */
export interface PublishPreview {
  /* The live version it would follow; null before the first publish. */
  basedOnVersion: number | null;
  problems: ErrorDetail[];
  snapshot: PublishedSnapshot | null;
}

export interface PublishStatus {
  /* null until the first publish. */
  active: { version: number; publishedAt: string; publishedBy: string; deployment: DeploymentState | null } | null;
  hasUnpublishedChanges: boolean;
  /* Which settings sections differ from what is live (all of them before
     the first publish). */
  changedSections: string[];
  settingsReady: boolean;
  canPublish: boolean;
  deployment: { configured: boolean };
  /* M14: the editorial queue — approved revisions the next publish takes,
     revisions waiting for review (not taken), and what would stop the
     publish (the same checks, without asking the donation provider). */
  review: {
    /* NOW: approved, taken by the next publish (unscheduled, or due). */
    approved: ReviewItem[];
    /* SCHEDULED (M15): approved, waiting for their time — or failed. */
    scheduled: ScheduledItem[];
    /* WAITING: submitted for review. */
    submitted: ReviewItem[];
    totals: { approved: number; scheduled: number; submitted: number };
  };
  blockers: string[];
  /* M14: names exactly what this review shows would be published. A
     publish that sends it back is refused (409) when what it would publish
     has changed since — an approval, edit or publish elsewhere. null
     before settings exist. */
  changesKey: string | null;
}

export interface ReviewItem {
  section: string;
  title: string;
}

export interface ScheduledItem extends ReviewItem {
  at: string;
  timeZone: string;
  /* The publication it was due in was refused; it waits for an owner. */
  failed: boolean;
}

/* A record's name, for the editorial queue. */
const titleOf = (r: Record<string, unknown>, fallback: string): string => String(r.title ?? r.name ?? (r.value && r.label ? `${r.value} ${r.label}` : undefined) ?? r.heading ?? fallback);

export interface PublishResult {
  version: number;
  generatedAt: string;
  deployment: DeploymentOutcome;
  /* M15: scheduled revisions this publish took. */
  scheduled: number;
}

/* What one scheduler run did (M15). */
export type SchedulerResult =
  | { outcome: "idle" | "busy" | "recovered" | "redeployed"; due: number }
  | { outcome: "published"; due: number; version: number }
  | { outcome: "already-published"; due: number }
  | { outcome: "failed"; due: number; problems: string[] };

/* A due-or-future schedule, wherever it is. */
interface ScheduleEntry {
  section: string;
  id: string;
  title: string;
  at: string;
  timeZone: string;
  failedAt?: string;
  fail(failedAt: string, problems: string[]): Promise<void>;
}

/* A scheduled revision a publish takes. */
interface DueItem {
  section: string;
  id: string;
  at: string;
}

export class PublishService {
  readonly #store: PublishStore;
  readonly #settings: SettingsStore;
  readonly #media: MediaStore;
  readonly #posts: ContentStore<Post & { title: string }>;
  readonly #events: ContentStore<Event>;
  readonly #appeals: ContentStore<Appeal> | null;
  readonly #donationPage: DonationPageStore | null;
  readonly #homepage: HomepageStore | null;
  readonly #about: BlockPageStore<About> | null;
  readonly #team: ContentStore<TeamMember> | null;
  readonly #programs: ContentStore<Program> | null;
  readonly #metrics: ContentStore<Metric> | null;
  readonly #reports: ContentStore<Report> | null;
  readonly #impact: BlockPageStore<Impact> | null;
  readonly #transparency: BlockPageStore<Transparency> | null;
  readonly #stories: ContentStore<Post & { title: string }> | null;
  readonly #projects: ContentStore<Project> | null;
  readonly #careers: BlockPageStore<Careers> | null;
  readonly #policies: Partial<Record<PolicyId, BlockPageStore<Policy>>>;
  readonly #getInvolved: Partial<Record<GetInvolvedPageId, BlockPageStore<GetInvolvedPage>>>;
  readonly #announcementBar: BlockPageStore<AnnouncementBar> | null;
  readonly #popup: BlockPageStore<Popup> | null;
  readonly #storyStrip: BlockPageStore<StoryStrip> | null;
  readonly #verify: CheckoutVerifier | null;
  readonly #audit: AuditService;
  readonly #deploy: DeploymentTrigger;
  readonly #orgId: string;
  readonly #log: Logger;
  readonly #now: () => Date;

  constructor(
    stores: {
      publish: PublishStore;
      settings: SettingsStore;
      media: MediaStore;
      posts: ContentStore<Post & { title: string }>;
      events: ContentStore<Event>;
      appeals?: ContentStore<Appeal>;
      donationPage?: DonationPageStore;
      homepage?: HomepageStore;
      about?: BlockPageStore<About>;
      team?: ContentStore<TeamMember>;
      programs?: ContentStore<Program>;
      metrics?: ContentStore<Metric>;
      reports?: ContentStore<Report>;
      impact?: BlockPageStore<Impact>;
      transparency?: BlockPageStore<Transparency>;
      stories?: ContentStore<Post & { title: string }>;
      projects?: ContentStore<Project>;
      careers?: BlockPageStore<Careers>;
      policies?: Partial<Record<PolicyId, BlockPageStore<Policy>>>;
      getInvolved?: Partial<Record<GetInvolvedPageId, BlockPageStore<GetInvolvedPage>>>;
      announcementBar?: BlockPageStore<AnnouncementBar>;
      popup?: BlockPageStore<Popup>;
      storyStrip?: BlockPageStore<StoryStrip>;
    },
    audit: AuditService,
    deploy: DeploymentTrigger,
    { orgId, log, now = () => new Date(), verifyCheckouts }: { orgId: string; log: Logger; now?: () => Date; verifyCheckouts?: CheckoutVerifier }
  ) {
    this.#store = stores.publish;
    this.#settings = stores.settings;
    this.#media = stores.media;
    this.#posts = stores.posts;
    this.#events = stores.events;
    this.#appeals = stores.appeals ?? null;
    this.#donationPage = stores.donationPage ?? null;
    this.#homepage = stores.homepage ?? null;
    this.#about = stores.about ?? null;
    this.#team = stores.team ?? null;
    this.#programs = stores.programs ?? null;
    this.#metrics = stores.metrics ?? null;
    this.#reports = stores.reports ?? null;
    this.#impact = stores.impact ?? null;
    this.#transparency = stores.transparency ?? null;
    this.#stories = stores.stories ?? null;
    this.#projects = stores.projects ?? null;
    this.#careers = stores.careers ?? null;
    this.#policies = stores.policies ?? {};
    this.#getInvolved = stores.getInvolved ?? {};
    this.#announcementBar = stores.announcementBar ?? null;
    this.#popup = stores.popup ?? null;
    this.#storyStrip = stores.storyStrip ?? null;
    this.#verify = verifyCheckouts ?? null;
    this.#audit = audit;
    this.#deploy = deploy;
    this.#orgId = orgId;
    this.#log = log;
    this.#now = now;
  }

  #member(auth: AuthContext) {
    if (auth.organization.id !== this.#orgId) throw errors.forbidden("You do not have permission to do this.");
    return auth;
  }

  /* The content a snapshot would hold now (M14: see above), and how to
     mark what goes live once it is. `live` is the active snapshot (its
     records are carried forward); `generatedAt` dates a first publish
     (`content`; `keyed` holds the FIRST_PUBLISH placeholder instead).
     Presence rules per key — news, blogs, events, appeals and the team
     (Milestone 1): the key appears once the collection has been on the
     website — a record of the kind is publishable now, or one was ever
     published (`countEverPublished`: archived ones included), or the live
     snapshot holds records of it. From then on the CMS is the source, and
     an empty list is an intentional one (every record since archived). A
     collection of drafts, submissions, not-yet-due approvals or records
     archived before they were ever published never replaces the
     website's own. Programs, figures, documents, stories and projects:
     once one is publishable. Pages: only with a publishable version. */
  async #collections(live: SnapshotContent | null, generatedAt: string): Promise<{ content: SnapshotContent; keyed: SnapshotContent; marks: (() => Promise<void>)[]; scheduled: DueItem[]; scheduleProblems: ErrorDetail[] }> {
    const marks: (() => Promise<void>)[] = [];
    const scheduled: DueItem[] = [];
    const scheduleProblems: ErrorDetail[] = [];
    /* M15: an approved revision with a schedule is taken only when due, and
       only while it is the content that was scheduled. */
    const due = (section: string, id: string, record: object, schedule: StoredContent<ContentRecordBase>["schedule"]) => {
      if (!schedule) return true;
      if (fingerprintOf(record) !== schedule.fingerprint) {
        scheduleProblems.push({ path: `schedule.${section}.${id}`, message: "no longer matches the approved revision it was scheduled for — unschedule it, or approve and schedule it again" });
        return false;
      }
      if (Date.parse(schedule.at) > Date.parse(generatedAt)) return false;
      scheduled.push({ section, id, at: schedule.at });
      return true;
    };
    const publishable = <R extends { id: string; status: string; publishedAt?: string }>(store: Pick<ContentStore<R & ContentRecordBase>, "markPublished"> | null, row: StoredContent<R & ContentRecordBase>, liveById: Map<string, unknown>, order: boolean, section: string): (R & { publishedAt?: string }) | undefined => {
      const r = row.record;
      if (r.status === "published" || (r.status === "approved" && due(section, r.id, r, row.schedule))) {
        if (store) marks.push(() => store.markPublished(r.id, row.revision, generatedAt));
        return { ...r, status: "published", publishedAt: r.publishedAt ?? FIRST_PUBLISH };
      }
      // Changed since it was published: its published version stays (the website's order, the editor's — see below).
      const was = liveById.get(r.id) as R | undefined;
      return was && order ? ({ ...was, order: (r as unknown as { order: number }).order } as R) : was;
    };
    const byId = (...lists: ({ id: string }[] | undefined)[]) => new Map(lists.flatMap((l) => l ?? []).map((r) => [r.id, r]));
    const take = async <R extends ContentRecordBase & { publishedAt?: string }>(store: ContentStore<R> | null, liveLists: ({ id: string }[] | undefined)[], section: string, order = false) => {
      const rows = store ? await store.listForPublish() : [];
      const liveById = byId(...liveLists);
      return rows.map((row) => ({ row, record: publishable(store, row as never, liveById, order, section) as R | undefined })).filter((x): x is { row: StoredContent<R>; record: R } => Boolean(x.record));
    };
    const page = <R extends { id: string; status: string; publishedAt?: string }>(store: { markPublished(revision: number, at: string): Promise<void> } | null, stored: { record: R; revision: number; publishedRevision?: number | null; schedule?: StoredContent<ContentRecordBase>["schedule"] } | null, liveRecord: unknown, section: string): R | undefined => {
      if (!stored || stored.record.status === "archived") return undefined;
      const r = stored.record;
      if (r.status === "published" || (r.status === "approved" && due(section, r.id, r, stored.schedule))) {
        if (store) marks.push(() => store.markPublished(stored.revision, generatedAt));
        return { ...r, status: "published", publishedAt: r.publishedAt ?? FIRST_PUBLISH };
      }
      return isLive(stored) ? (liveRecord as R | undefined) : undefined;
    };
    const ordered = <R extends { order: number; id: string; createdAt?: string; updatedAt?: string }>(list: R[]) => [...list].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map(forSnapshot);

    const [everNews, everBlogs, posts, everEvents, events, everAppeals, appeals, donationPage, home, about, everTeam, team, programs, metrics, reports, impact, transparency, stories, projects, careers] = await Promise.all([
      this.#posts.countEverPublished({ type: "news" }),
      this.#posts.countEverPublished({ type: "blog" }),
      take(this.#posts, [live?.news, live?.blogs], "News and blogs"),
      this.#events.countEverPublished(),
      take(this.#events, [live?.events], "Events"),
      this.#appeals?.countEverPublished() ?? 0,
      take(this.#appeals, [live?.appeals], "Appeals"),
      this.#donationPage?.get() ?? null,
      this.#homepage?.get() ?? null,
      this.#about?.get() ?? null,
      this.#team?.countEverPublished() ?? 0,
      take(this.#team, [live?.team], "Team", true),
      take(this.#programs, [live?.programs], "Programs", true),
      take(this.#metrics, [live?.metrics], "Impact figures", true),
      take(this.#reports, [live?.reports], "Transparency documents", true),
      this.#impact?.get() ?? null,
      this.#transparency?.get() ?? null,
      take(this.#stories, [live?.stories], "Stories"),
      take(this.#projects, [live?.projects], "Projects", true),
      this.#careers?.get() ?? null,
    ]);
    const policyRows = await Promise.all(POLICY_IDS.map(async (id) => ({ id, stored: (await this.#policies[id]?.get()) ?? null })));
    const announcementBar = (await this.#announcementBar?.get()) ?? null;
    const popupRow = (await this.#popup?.get()) ?? null;
    const stripRow = (await this.#storyStrip?.get()) ?? null;
    const getInvolvedRows = await Promise.all(GET_INVOLVED_PAGE_IDS.map(async (id) => ({ id, stored: (await this.#getInvolved[id]?.get()) ?? null })));
    const records = <R>(list: { record: R }[]) => list.map((x) => x.record);
    const content: SnapshotContent = {};
    /* On the website already (see above): carried, records or none. */
    const onWebsite = (carried: unknown[], everPublished: number, liveList: unknown[] | undefined) => carried.length > 0 || everPublished > 0 || (liveList?.length ?? 0) > 0;
    const news = records(posts).filter((p) => p.type === "news");
    const blogs = records(posts).filter((p) => p.type === "blog");
    if (onWebsite(news, everNews, live?.news)) content.news = news.map(forSnapshot);
    if (onWebsite(blogs, everBlogs, live?.blogs)) content.blogs = blogs.map(forSnapshot);
    if (onWebsite(events, everEvents, live?.events)) content.events = records(events).map(forSnapshot);
    if (onWebsite(appeals, everAppeals, live?.appeals)) content.appeals = records(appeals).map(forSnapshot);
    const enabledOnly = <P extends { sections: { enabled: boolean }[] }>(p: P | undefined) => p && { ...forSnapshot(p as P & { createdAt?: string; updatedAt?: string }), sections: p.sections.filter((s) => s.enabled) };
    const donation = page(this.#donationPage, donationPage, live?.generalDonation, "Donation page");
    if (donation) content.generalDonation = forSnapshot(donation);
    const homepage = enabledOnly(page(this.#homepage, home, live?.homepage, "Homepage"));
    if (homepage) content.homepage = homepage as SnapshotContent["homepage"];
    const aboutPage = enabledOnly(page(this.#about, about, live?.about, "About page"));
    if (aboutPage) content.about = aboutPage as SnapshotContent["about"];
    // The team in its order (ties by id): the snapshot's order is the page's.
    if (onWebsite(team, everTeam, live?.team)) content.team = ordered(records(team));
    /* Programs only once at least one is publishable: other records name
       programs, so an empty set would leave them pointing at nothing — the
       website keeps its own programs until then. Figures, documents and
       projects likewise. */
    if (programs.length > 0) content.programs = ordered(records(programs));
    if (metrics.length > 0) content.metrics = ordered(records(metrics));
    if (reports.length > 0) content.reports = ordered(records(reports));
    const impactPage = enabledOnly(page(this.#impact, impact, live?.impact, "Impact page"));
    if (impactPage) content.impact = impactPage as SnapshotContent["impact"];
    const transparencyPage = page(this.#transparency, transparency, live?.transparency, "Transparency");
    if (transparencyPage) content.transparency = forSnapshot(transparencyPage);
    if (projects.length > 0) content.projects = ordered(records(projects));
    // Stories newest first by date, undated ones after, in the order they were added (the website's own rule).
    if (stories.length > 0)
      content.stories = [...stories]
        .sort((a, b) => (b.record.date ?? "").localeCompare(a.record.date ?? "") || (a.row.record.createdAt ?? "").localeCompare(b.row.record.createdAt ?? "") || a.record.id.localeCompare(b.record.id))
        .map((x) => forSnapshot(x.record));
    const careersPage = page(this.#careers, careers, live?.careers, "Careers page");
    if (careersPage) content.careers = forSnapshot(careersPage);
    /* Policies (M19): each one published (or approved and due) — or, while
       a newer revision waits, the version already live — in the fixed
       order; the key only once at least one is publishable, so a policy
       the CMS does not publish keeps the website's own record. */
    const policies = policyRows
      .map(({ id, stored }) => page(this.#policies[id] ?? null, stored, live?.policies?.find((p) => p.id === id), POLICY_SECTIONS[id]))
      .filter((p): p is Policy => Boolean(p))
      .map(forSnapshot);
    if (policies.length > 0) content.policies = policies;
    /* Get Involved (M20): as the policies — hub, then the four paths. */
    const getInvolved = getInvolvedRows
      .map(({ id, stored }) => page(this.#getInvolved[id] ?? null, stored, live?.getInvolved?.find((p) => p.id === id), GET_INVOLVED_LABELS[id]))
      .filter((p): p is GetInvolvedPage => Boolean(p))
      .map((p) => forSnapshot(p) as GetInvolvedPage);
    if (getInvolved.length > 0) content.getInvolved = getInvolved;
    const bar = page(this.#announcementBar, announcementBar, live?.announcementBar, "Announcement bar");
    if (bar) content.announcementBar = forSnapshot(bar);
    const popup = page(this.#popup, popupRow, live?.popup, "Popup");
    if (popup) content.popup = forSnapshot(popup);
    const strip = page(this.#storyStrip, stripRow, live?.storyStrip, "Highlights");
    if (strip) content.storyStrip = forSnapshot(strip);
    return { content: stamp(content, generatedAt), keyed: content, marks, scheduled, scheduleProblems };
  }

  /* M14: the editorial queue — what is approved (the next publish takes
     it) and what waits for review, across every collection and page; M15:
     and what is approved but scheduled for later (or failed), apart. */
  #sections(): [string, ContentStore<ContentRecordBase> | null][] {
    return [
      ["News and blogs", this.#posts as never], ["Events", this.#events as never], ["Appeals", this.#appeals as never], ["Team", this.#team as never],
      ["Programs", this.#programs as never], ["Impact figures", this.#metrics as never], ["Transparency documents", this.#reports as never],
      ["Stories", this.#stories as never], ["Projects", this.#projects as never],
    ];
  }
  #pages(): [string, { get(): Promise<{ record: { id: string; status: string }; schedule?: StoredContent<ContentRecordBase>["schedule"] } | null>; markScheduleFailed(at: string, failedAt: string, problems: string[]): Promise<void> } | null][] {
    return [
      ["Donation page", this.#donationPage], ["Homepage", this.#homepage], ["About page", this.#about], ["Impact page", this.#impact], ["Transparency", this.#transparency], ["Careers page", this.#careers],
      ...POLICY_IDS.map((id) => [POLICY_SECTIONS[id], this.#policies[id] ?? null]),
      ...GET_INVOLVED_PAGE_IDS.map((id) => [GET_INVOLVED_LABELS[id], this.#getInvolved[id] ?? null]),
      ["Announcement bar", this.#announcementBar],
      ["Popup", this.#popup],
      ["Highlights", this.#storyStrip],
    ] as never;
  }

  /* Every schedule, collections and pages alike (M15). */
  async #schedules(): Promise<ScheduleEntry[]> {
    const entries: ScheduleEntry[] = [];
    for (const [section, store] of this.#sections()) {
      if (!store) continue;
      for (const row of await store.listScheduled())
        entries.push({ section, id: row.record.id, title: titleOf(row.record as unknown as Record<string, unknown>, section), at: row.schedule!.at, timeZone: row.schedule!.timeZone, failedAt: row.schedule!.failedAt, fail: (failedAt, problems) => store.markScheduleFailed(row.record.id, row.schedule!.at, failedAt, problems) });
    }
    for (const [section, store] of this.#pages()) {
      const stored = store ? await store.get() : null;
      if (store && stored?.record.status === "approved" && stored.schedule) {
        const at = stored.schedule.at;
        entries.push({ section, id: stored.record.id, title: section, at, timeZone: stored.schedule.timeZone, failedAt: stored.schedule.failedAt, fail: (failedAt, problems) => store.markScheduleFailed(at, failedAt, problems) });
      }
    }
    return entries.sort((a, b) => a.at.localeCompare(b.at));
  }

  async #review(now: Date): Promise<PublishStatus["review"]> {
    const review: PublishStatus["review"] = { approved: [], scheduled: [], submitted: [], totals: { approved: 0, scheduled: 0, submitted: 0 } };
    /* SCHEDULED: approved, not due yet — or failed (waiting for an owner). */
    const later = (await this.#schedules()).filter((e) => e.failedAt || Date.parse(e.at) > now.getTime());
    const held = new Set(later.map((e) => `${e.section}:${e.id}`));
    review.scheduled = later.map((e) => ({ section: e.section, title: e.title, at: e.at, timeZone: e.timeZone, failed: Boolean(e.failedAt) }));
    review.totals.scheduled = later.length;
    /* Up to 50 items per collection are named; the totals count them all. */
    for (const status of ["approved", "submitted"] as const) {
      for (const [section, store] of this.#sections()) {
        if (!store) continue;
        const { items, total } = await store.list({ status, sort: "updated", page: 1, pageSize: 50 });
        const heldHere = status === "approved" ? later.filter((e) => e.section === section).length : 0;
        for (const row of items) if (status !== "approved" || !held.has(`${section}:${row.record.id}`)) review[status].push({ section, title: titleOf(row.record as unknown as Record<string, unknown>, section) });
        review.totals[status] += total - heldHere;
      }
      for (const [section, store] of this.#pages()) {
        const stored = store ? await store.get() : null;
        if (stored?.record.status === status && !(status === "approved" && held.has(`${section}:${stored.record.id}`))) {
          review[status].push({ section, title: section });
          review.totals[status] += 1;
        }
      }
    }
    return review;
  }

  /* The candidate snapshot from these settings and contents, and every
     problem that would stop it — the media each reference must resolve to,
     the whole content contract, the secret scan. Not the donation
     provider's checks (the publish asks it, last). */
  async #candidate(working: SiteSettings, content: SnapshotContent, generatedAt: string): Promise<{ candidate: Omit<PublishedSnapshot, "version"> & { version: number }; problems: ErrorDetail[] }> {
    const { releaseMarker: _internal, ...record } = working;
    const settings: SiteSettings = { ...record, status: "published", publishedAt: generatedAt };
    const problems: ErrorDetail[] = [];
    const media: Record<string, PublishedMedia> = {};
    /* Who points at each media id, for a precise error. */
    const referrers = new Map<string, string[]>();
    const refer = (id: string, path: string) => referrers.set(id, [...(referrers.get(id) ?? []), path]);
    settingsMediaIds(settings).forEach((id) => refer(id, "settings"));
    for (const key of ["news", "blogs", "events", "stories"] as const) for (const r of content[key] ?? []) recordMediaIds(r).forEach((id) => refer(id, `content.${key}.${r.slug}`));
    for (const p of content.projects ?? []) projectMediaIds(p).forEach((id) => refer(id, `content.projects.${p.slug}`));
    for (const appeal of content.appeals ?? []) appealMediaIds(appeal).forEach((id) => refer(id, `content.appeals.${appeal.slug}`));
    if (content.generalDonation) donationPageMediaIds(content.generalDonation).forEach((id) => refer(id, "content.generalDonation"));
    if (content.homepage) homepageMediaIds(content.homepage).forEach((id) => refer(id, "content.homepage"));
    if (content.about) aboutMediaIds(content.about).forEach((id) => refer(id, "content.about"));
    for (const m of content.team ?? []) if (m.imageId) refer(m.imageId, `content.team.${m.slug}`);
    for (const p of content.programs ?? []) if (p.seo?.ogImageId) refer(p.seo.ogImageId, `content.programs.${p.slug}`);
    if (content.impact) impactMediaIds(content.impact).forEach((id) => refer(id, "content.impact"));
    if (content.popup) refer(content.popup.imageId, "content.popup");
    const found = new Map((await this.#media.findMany([...referrers.keys()])).map((m) => [m.id, m]));
    for (const [id, paths] of referrers) {
      const item = found.get(id);
      if (!item || item.status !== "ready" || item.kind !== "image" || !item.publicUrl) {
        for (const path of paths) problems.push({ path: `${path}.media.${id}`, message: "refers to an image that is missing, not ready or deleted" });
        continue;
      }
      /* Milestone 2: the focal point and caption travel with the image, when it has them. */
      media[id] = { id, url: item.publicUrl, mimeType: item.mimeType, ...(item.width && { width: item.width }), ...(item.height && { height: item.height }), alt: item.alt, ...(item.focal && { focal: item.focal }), ...(item.caption?.trim() && { caption: item.caption.trim() }) };
    }
    const candidate = { version: 1, schemaVersion: SNAPSHOT_SCHEMA_VERSION, generatedAt, organization: { id: this.#orgId }, settings, media, content } as Omit<PublishedSnapshot, "version"> & { version: number };
    const checked = PublishedSnapshot.safeParse(candidate);
    if (!checked.success) problems.push(...checked.error.issues.map((i) => ({ path: ["snapshot", ...i.path.map(String)].join("."), message: i.message })));
    problems.push(...secretProblems(candidate).map((path) => ({ path, message: "looks like a credential and cannot be published" })));
    /* Milestone 1: a policy approved before working text was refused is
       refused here — the website build would fail on it. */
    for (const p of content.policies ?? []) problems.push(...policyWorkingTextProblems(p, `content.policies.${p.id}`));
    return { candidate, problems };
  }

  /* Milestone 2: the focal points and captions of the images this content
     uses (Framing). */
  async #framing(settings: SiteSettings, content: SnapshotContent): Promise<Framing> {
    const ids = snapshotMediaIds(settings, content);
    if (!ids.length) return {};
    const framing: Framing = {};
    for (const m of await this.#media.findMany(ids)) {
      const caption = m.caption?.trim();
      if (m.focal || caption) framing[m.id] = { ...(m.focal && { focal: m.focal }), ...(caption && { caption }) };
    }
    return framing;
  }

  /* Every provider checkout the candidate would make public — verified
     again at publish: a campaign can be closed after the page was saved. */
  async #checkoutProblems(content: SnapshotContent): Promise<ErrorDetail[]> {
    const references: CheckoutReference[] = [
      ...(content.appeals ?? []).flatMap((a) => (a.donation?.checkout ? [{ path: `content.appeals.${a.slug}.donation.checkout`, checkout: a.donation.checkout }] : [])),
      ...(content.generalDonation?.donation.checkout ? [{ path: "content.generalDonation.donation.checkout", checkout: content.generalDonation.donation.checkout }] : []),
    ];
    if (!references.length) return [];
    if (!this.#verify) return references.map(({ path }) => ({ path: `${path}.campaignId`, message: "cannot be verified: the donation provider is not configured on the server" }));
    return this.#verify(references);
  }

  async status(auth: AuthContext): Promise<PublishStatus> {
    this.#member(auth);
    const now = this.#now();
    const [settings, active, live, review] = await Promise.all([this.#settings.get(), this.#store.active(), this.#store.activeSnapshot(), this.#review(now)]);
    const generatedAt = now.toISOString();
    const { content: collections, keyed, scheduleProblems } = await this.#collections(live?.snapshot.content ?? null, generatedAt);
    const blockers = settings
      ? [...(await this.#candidate(settings.record, collections, generatedAt)).problems, ...scheduleProblems].map((p) => `${p.path}: ${p.message}`).slice(0, 20)
      : [];
    const sourceHash = settings ? contentHash(settings.record, keyed, await this.#framing(settings.record, keyed)) : null;
    const changedSections = settings
      ? [
          ...SECTIONS.filter((section) => !live || canonical(settings.record[section]) !== canonical(live.snapshot.settings[section])),
          ...CONTENT_KEYS.filter((key) => (live ? canonical(collections[key]) !== canonical(live.snapshot.content[key]) : collections[key] !== undefined)),
        ]
      : [];
    return {
      active: active ? { version: active.version, publishedAt: active.generatedAt, publishedBy: active.publishedBy.name, deployment: active.deployment ?? null } : null,
      hasUnpublishedChanges: Boolean(settings) && (!active || sourceHash !== active.sourceHash),
      changedSections,
      settingsReady: Boolean(settings),
      canPublish: can(auth, "publish:execute"),
      deployment: { configured: this.#deploy.name !== "none" },
      review,
      blockers,
      changesKey: sourceHash && `${active?.version ?? 0}:${sourceHash}`,
    };
  }

  /* M36: the candidate status() checks and publish() would store — approved
     and published records over the working settings — shown to an OWNER
     only, and only read: no version is taken, nothing is marked published,
     no deployment runs and the public snapshot is untouched. A provider
     checkout is not verified here (publish() still does). */
  async preview(auth: AuthContext): Promise<PublishPreview> {
    this.#member(auth);
    if (!can(auth, "publish:execute")) throw errors.forbidden("Only an owner can preview what would be published.");
    const [settings, active, live] = await Promise.all([this.#settings.get(), this.#store.active(), this.#store.activeSnapshot()]);
    if (!settings) throw errors.conflict("Site settings have not been set up yet.");
    const generatedAt = this.#now().toISOString();
    const { content, scheduleProblems } = await this.#collections(live?.snapshot.content ?? null, generatedAt);
    const { candidate, problems } = await this.#candidate(settings.record, content, generatedAt);
    problems.push(...scheduleProblems);
    const basedOnVersion = active?.version ?? null;
    return { basedOnVersion, problems, snapshot: problems.length ? null : ({ ...candidate, version: (basedOnVersion ?? 0) + 1 } as PublishedSnapshot) };
  }

  /* Run `work` holding the publish lock (one publish or scheduler run at a
     time, across every server instance); `busy` when another holds it. */
  async #locked<T>(work: (lockId: string) => Promise<T>, busy: () => T): Promise<T> {
    const lockId = randomUUID();
    if (!(await this.#store.acquireLock(lockId, this.#now(), LOCK_TTL_MS))) return busy();
    try {
      return await work(lockId);
    } finally {
      await this.#store.releaseLock(lockId);
    }
  }

  /* `changesKey`, when given, is the status the owner reviewed (M14): a
     publish whose content differs from it is stale, and refused. */
  async publish(auth: AuthContext, facts: RequestFacts, { changesKey }: { changesKey?: string } = {}): Promise<PublishResult> {
    this.#member(auth);
    return this.#locked(
      async (lockId) => {
        await this.#recover(facts, { retryFailed: false });
        return this.#publishLocked(lockId, { id: auth.user.id, name: auth.user.name }, auth.user.id, facts, { changesKey, trigger: "manual" });
      },
      () => {
        throw errors.conflict(PUBLISH_BUSY);
      }
    );
  }

  /* M15: the scheduler — ONE run for every content type. Under the publish
     lock: finish a publish that stopped part-way (and retry a failed
     deployment trigger); then, if any approved schedule is due (and has not
     failed), publish the website through the same pipeline as an owner's
     publish. Idempotent: a second run finds nothing due (the first marked
     what it took) or the lock held, and does nothing. A refused publication
     leaves the live snapshot as it was and marks the due schedules failed —
     they wait for an owner instead of failing again every run. */
  async runScheduled(facts: RequestFacts): Promise<SchedulerResult> {
    return this.#locked<SchedulerResult>(
      async (lockId) => {
        const recovered = await this.#recover(facts, { retryFailed: true });
        const now = this.#now();
        const due = (await this.#schedules()).filter((e) => !e.failedAt && Date.parse(e.at) <= now.getTime());
        if (!due.length) return { outcome: recovered ?? "idle", due: 0 };
        try {
          const result = await this.#publishLocked(lockId, SCHEDULER, null, facts, { trigger: "schedule" });
          return { outcome: "published", due: due.length, version: result.version };
        } catch (error) {
          if (error instanceof ApiError && error.code === "CONFLICT" && error.message === NO_CHANGES) return { outcome: "already-published", due: due.length };
          if (!(error instanceof ApiError) || (error.code !== "VALIDATION_ERROR" && error.code !== "CONFLICT")) throw error;
          const problems = error.details?.length ? error.details.map((d) => d.path).slice(0, 20) : [error.message];
          const failedAt = this.#now().toISOString();
          for (const entry of due) await entry.fail(failedAt, problems);
          if (error.code === "CONFLICT")
            await this.#audit.recordSafely({ action: "publish.rejected", resourceType: "snapshot", actorUserId: null, metadata: { problems, trigger: "schedule" } }, facts);
          this.#log.warn("a scheduled publication was refused", { due: due.length, problems: problems.length });
          return { outcome: "failed", due: due.length, problems };
        }
      },
      () => ({ outcome: "busy", due: 0 })
    );
  }

  /* Finish what a publish that stopped part-way left (the public moved,
     but the deployment was never told): mark what went live, trigger the
     deployment, audit it — once. With `retryFailed`, also try a failed
     deployment trigger again, up to MAX_DEPLOY_ATTEMPTS in all. Only ever
     called holding the publish lock, so nothing else is mid-publish. */
  async #recover(facts: RequestFacts, { retryFailed }: { retryFailed: boolean }): Promise<"recovered" | "redeployed" | null> {
    const active = await this.#store.active();
    const state = active?.deployment;
    if (!active || !state) return null;
    if (state.status === "pending") {
      const [working, live] = await Promise.all([this.#settings.get(), this.#store.activeSnapshot()]);
      if (working && live) {
        const { keyed, marks } = await this.#collections(live.snapshot.content, active.generatedAt);
        // Mark only if what is approved now is exactly what went live.
        if (contentHash(working.record, keyed, await this.#framing(working.record, keyed)) === active.sourceHash) await this.#runMarks(marks, active.version);
      }
      const deployment = await this.#deployVersion(active.version, state.attempts);
      await this.#audit.recordSafely({ action: "publish.completed", resourceType: "snapshot", resourceId: String(active.version), actorUserId: null, metadata: { version: active.version, deployment: deployment.status, trigger: "recovery" } }, facts);
      return "recovered";
    }
    if (retryFailed && state.status === "failed" && state.attempts < MAX_DEPLOY_ATTEMPTS) {
      const deployment = await this.#deployVersion(active.version, state.attempts);
      await this.#audit.recordSafely({ action: "publish.redeployed", resourceType: "snapshot", resourceId: String(active.version), actorUserId: null, metadata: { version: active.version, deployment: deployment.status, attempt: state.attempts + 1 } }, facts);
      return "redeployed";
    }
    return null;
  }

  async #runMarks(marks: (() => Promise<void>)[], version: number) {
    /* The snapshot is the truth; a mark that fails is logged and repeated,
       harmlessly, by the next publish. */
    for (const mark of marks) await mark().catch((error: unknown) => this.#log.warn("could not mark a published record", { version, reason: error instanceof Error ? error.message : String(error) }));
  }

  /* Tell the deployment about `version`, and keep what it answered. */
  async #deployVersion(version: number, attempts: number): Promise<DeploymentOutcome> {
    const deployment = await this.#deploy.trigger({ orgId: this.#orgId, version });
    if (deployment.status === "failed") this.#log.warn("deployment trigger failed", { version, reason: deployment.reason });
    await this.#store.setDeployment(version, { status: deployment.status, attempts: attempts + 1, ...(deployment.status === "failed" && { reason: deployment.reason }), at: this.#now().toISOString() });
    return deployment;
  }

  /* One publish, the lock held: an owner's (`actor` their user id) or the
     scheduler's (null). */
  async #publishLocked(
    lockId: string,
    publishedBy: { id: string; name: string },
    actor: string | null,
    facts: RequestFacts,
    { changesKey, trigger }: { changesKey?: string; trigger: "manual" | "schedule" }
  ): Promise<PublishResult> {
    const working = await this.#settings.get();
    if (!working) throw errors.conflict("Site settings have not been set up yet.");
    const active = await this.#store.active();
    const live = await this.#store.activeSnapshot();
    const generatedAt = this.#now().toISOString();
    const { content, keyed, marks, scheduled, scheduleProblems } = await this.#collections(live?.snapshot.content ?? null, generatedAt);
    const framing = await this.#framing(working.record, keyed);
    const reviewHash = contentHash(working.record, keyed, framing);
    if (active && active.sourceHash === reviewHash) {
      // Nothing new — but what is approved IS what is live: make sure it reads published.
      await this.#runMarks(marks, active.version);
      throw errors.conflict(NO_CHANGES);
    }
    if (changesKey !== undefined && changesKey !== `${active?.version ?? 0}:${reviewHash}`)
      throw errors.conflict("What would be published has changed since you reviewed it. Review the changes again before publishing.");
    // What is stored: the snapshot's own content, real dates included.
    const sourceHash = contentHash(working.record, content, framing);
    const { candidate, problems } = await this.#candidate(working.record, content, generatedAt);
    problems.push(...scheduleProblems);
    // The provider is asked only about a candidate that is otherwise valid.
    if (!problems.length) problems.push(...(await this.#checkoutProblems(content)));
    if (problems.length) {
      await this.#audit.recordSafely({ action: "publish.rejected", resourceType: "snapshot", actorUserId: actor, metadata: { problems: problems.map((p) => p.path), trigger } }, facts);
      throw errors.validation(problems, "The changes could not be published.");
    }

    const version = await this.#store.nextVersion(lockId);
    const snapshot = PublishedSnapshot.parse({ ...candidate, version });
    const stored: StoredSnapshot = { snapshot, version, generatedAt, publishedBy, sourceHash };
    await this.#store.insertSnapshot(stored);
    if (!(await this.#store.activate(lockId, { version, generatedAt, publishedBy, sourceHash, deployment: { status: "pending", attempts: 0 } })))
      throw errors.conflict("The publish took too long and was stopped. Nothing changed; try again.");
    /* M14: what went live is marked (approved → published; M15: its
       schedule is done). */
    await this.#runMarks(marks, version);

    const deployment = await this.#deployVersion(version, 0);
    await this.#audit.recordSafely(
      {
        action: "publish.completed",
        resourceType: "snapshot",
        resourceId: String(version),
        actorUserId: actor,
        metadata: {
          version,
          previousVersion: active?.version ?? null,
          deployment: deployment.status,
          trigger,
          ...(scheduled.length && { scheduled: scheduled.map((s) => ({ section: s.section, id: s.id, at: s.at })) }),
          counts: { ...Object.fromEntries(COLLECTION_KEYS.filter((k) => content[k]).map((k) => [k, content[k]!.length])), ...(content.generalDonation && { generalDonation: 1 }), ...(content.homepage && { homepage: content.homepage.sections.length }), ...(content.about && { about: content.about.sections.length }), ...(content.impact && { impact: content.impact.sections.length }), ...(content.transparency && { transparency: 1 }), ...(content.careers && { careers: content.careers.opportunities.roles.length }), ...(content.policies && { policies: content.policies.length }), ...(content.getInvolved && { getInvolved: content.getInvolved.length }), ...(content.announcementBar && { announcementBar: content.announcementBar.items.length }), ...(content.popup && { popup: 1 }), ...(content.storyStrip && { storyStrip: content.storyStrip.appealIds.length }) },
        },
      },
      facts
    );
    return { version, generatedAt, deployment, scheduled: scheduled.length };
  }

  /* M16: where a media item is still needed — the live website (the
     active snapshot), content approved, scheduled or published for it, and
     the saved site settings (which any publish takes). Drafts and
     submissions are not listed: they are not public, and their review
     refuses a missing image. Media ids are UUIDs, so a record that holds
     the id anywhere uses it. */
  async mediaUsage(mediaId: string): Promise<string[]> {
    const uses: string[] = [];
    const holds = (value: unknown) => JSON.stringify(value).includes(`"${mediaId}"`);
    const [live, settings] = await Promise.all([this.#store.activeSnapshot(), this.#settings.get()]);
    if (live?.snapshot.media[mediaId]) uses.push(`The live website (published version ${live.version})`);
    if (settings && holds(settings.record)) uses.push("Site settings");
    for (const [section, store] of this.#sections()) {
      if (!store) continue;
      for (const row of await store.listForPublish()) {
        if (row.record.status !== "approved" && row.record.status !== "published") continue;
        if (holds(row.record)) uses.push(`${section}: ${titleOf(row.record as unknown as Record<string, unknown>, section)} (${row.schedule ? "scheduled" : row.record.status})`);
      }
    }
    for (const [section, store] of this.#pages()) {
      const stored = store ? await store.get() : null;
      if (stored && (stored.record.status === "approved" || stored.record.status === "published") && holds(stored.record)) uses.push(`${section} (${stored.schedule ? "scheduled" : stored.record.status})`);
    }
    return uses;
  }

  /* The public read — no session. The organization is this deployment's. */
  async publicSnapshot(version?: number): Promise<PublishedSnapshot | null> {
    const stored = version === undefined ? await this.#store.activeSnapshot() : await this.#store.snapshotByVersion(version);
    return stored?.snapshot ?? null;
  }
}
