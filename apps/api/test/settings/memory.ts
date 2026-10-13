import { publishLock } from "../../src/modules/publishing/lock.ts";
import type { SiteSettings } from "@rbb/content-schema";
import { AuditService } from "../../src/modules/audit/audit.ts";
import type { MediaRecord } from "../../src/modules/media/types.ts";
import { NoDeploymentTrigger, type DeploymentTrigger } from "../../src/modules/publishing/deploy.ts";
import type { ActiveInfo, PublishStore, StoredSnapshot } from "../../src/modules/publishing/repository.ts";
import { PublishService } from "../../src/modules/publishing/service.ts";
import type { SettingsStore, StoredSettings } from "../../src/modules/settings/repository.ts";
import { SettingsService } from "../../src/modules/settings/service.ts";
import { clock, memoryAuditStore, memoryData, silentLog } from "../auth/memory.ts";
import { MemoryMediaStore } from "../media/memory.ts";
import { MemoryContentStore } from "../content/memory.ts";
import type { About, Appeal, Careers, Event, FormDefinition, HowWeWork, GeneralDonationPage, Homepage, Impact, Metric, Post, Program, Project, PublicationSchedule, Report, TeamMember, Transparency } from "@rbb/content-schema";
import { StoryService } from "../../src/modules/stories/service.ts";
import { ProjectService } from "../../src/modules/projects/service.ts";
import { CareersService } from "../../src/modules/careers/service.ts";
import { HowWeWorkService } from "../../src/modules/how-we-work/service.ts";
import { PolicyDirectory, PolicyService } from "../../src/modules/policies/service.ts";
import { POLICY_IDS, type PolicyId, GET_INVOLVED_PAGE_IDS, type GetInvolvedPageId } from "@rbb/content-schema";
import { GetInvolvedDirectory, GetInvolvedService } from "../../src/modules/get-involved/service.ts";
import { AnnouncementBarService } from "../../src/modules/announcements/service.ts";
import { PopupService } from "../../src/modules/popups/service.ts";
import { StoryStripService } from "../../src/modules/highlights/service.ts";
import { ProgramService } from "../../src/modules/programs/service.ts";
import { MetricService } from "../../src/modules/metrics/service.ts";
import { ReportService } from "../../src/modules/reports/service.ts";
import { ImpactService } from "../../src/modules/impact/service.ts";
import { TransparencyService } from "../../src/modules/transparency/service.ts";
import { AboutService } from "../../src/modules/about/service.ts";
import { TeamService } from "../../src/modules/team/service.ts";
import type { HomepageStore, StoredHomepage } from "../../src/modules/homepage/repository.ts";
import { HomepageService } from "../../src/modules/homepage/service.ts";
import { appealCollection } from "../../src/modules/appeals/service.ts";
import type { DonationPageStore, StoredDonationPage } from "../../src/modules/donation-page/repository.ts";
import { DonationPageService } from "../../src/modules/donation-page/service.ts";
import { checkoutVerifier } from "../../src/modules/donations/verify.ts";
import type { DonationProvider } from "../../src/modules/donations/provider.ts";
import { ProviderError } from "../../src/modules/donations/provider.ts";
import { FakeDonationProvider } from "../support/fake-donations.ts";
import type { StoredContent } from "../../src/modules/content/repository.ts";
import { ContentService } from "../../src/modules/content/service.ts";
import { postCollection } from "../../src/modules/posts/service.ts";
import { eventCollection } from "../../src/modules/events/service.ts";

/* In-memory settings and publish stores with the Mongo stores' contracts,
   over shared data so two organizations can sit side by side. */

export interface SharedData {
  settings: Map<string, StoredSettings>;
  publish: Map<string, { lastVersion: number; active: ActiveInfo | null; lockId: string | null; lockedUntil: number }>;
  snapshots: { orgId: string; activated: boolean; stored: StoredSnapshot }[];
  media: MediaRecord[];
  posts: (StoredContent<Post & { title: string }> & { orgId: string })[];
  events: (StoredContent<Event> & { orgId: string })[];
  appeals: (StoredContent<Appeal> & { orgId: string })[];
  donationPages: Map<string, StoredDonationPage>;
  homepages: Map<string, StoredHomepage>;
  abouts: Map<string, StoredHomepage>;
  team: (StoredContent<TeamMember> & { orgId: string })[];
  programs: (StoredContent<Program> & { orgId: string })[];
  metrics: (StoredContent<Metric> & { orgId: string })[];
  reports: (StoredContent<Report> & { orgId: string })[];
  projects: (StoredContent<Project> & { orgId: string })[];
  impacts: Map<string, StoredHomepage>;
  transparencies: Map<string, StoredHomepage>;
  careers: Map<string, StoredHomepage>;
  /* #7. */
  howWeWork: Map<string, StoredHomepage>;
  /* Website forms as saved in the admin (2026-10-13). */
  formDefinitions: FormDefinition[];
  /* One map per policy (M19), each keyed by organization. */
  policies: Record<PolicyId, Map<string, StoredHomepage>>;
  /* One map per Get Involved page (M20), each keyed by organization. */
  getInvolved: Record<GetInvolvedPageId, Map<string, StoredHomepage>>;
  announcementBars: Map<string, StoredHomepage>;
  popups: Map<string, StoredHomepage>;
  storyStrips: Map<string, StoredHomepage>;
  base: ReturnType<typeof memoryData>;
}
export const sharedData = (): SharedData => ({ settings: new Map(), publish: new Map(), snapshots: [], media: [], posts: [], events: [], appeals: [], donationPages: new Map(), homepages: new Map(), abouts: new Map(), team: [], programs: [], metrics: [], reports: [], projects: [], impacts: new Map(), transparencies: new Map(), careers: new Map(), howWeWork: new Map(), formDefinitions: [], policies: { privacy: new Map(), terms: new Map(), donation: new Map() }, getInvolved: { hub: new Map(), volunteer: new Map(), fellowship: new Map(), partner: new Map(), travel: new Map() }, announcementBars: new Map(), popups: new Map(), storyStrips: new Map(), base: memoryData() });

/* An in-memory block-page store (homepage, About) over a shared map. */
const memoryBlockPageStore = <R extends { orgId: string }>(pages: Map<string, { record: R; revision: number; createdAt: string; updatedAt: string; updatedBy: { id: string | null; name: string } }>, orgId: string) => ({
  get: async () => structuredClone(pages.get(orgId) ?? null),
  create: async (stored: { record: R; revision: number; createdAt: string; updatedAt: string; updatedBy: { id: string | null; name: string } }) => {
    if (stored.record.orgId !== orgId) throw new Error("Refusing to store a page for another organization");
    if (pages.has(orgId)) return false;
    pages.set(orgId, structuredClone(stored));
    return true;
  },
  replace: async (record: R, expectedRevision: number, by: { id: string | null; name: string }, at: string) => {
    if (record.orgId !== orgId) throw new Error("Refusing to store a page for another organization");
    const current = pages.get(orgId);
    if (!current || current.revision !== expectedRevision) return null;
    const status = (record as { status?: string }).status;
    const next: typeof current & { schedule?: PublicationSchedule | null } = { ...current, record: structuredClone(record), revision: expectedRevision + 1, updatedAt: at, updatedBy: by, ...(status === "archived" && { publishedRevision: null }) };
    if (status !== "approved") delete next.schedule;
    pages.set(orgId, next);
    return structuredClone(next);
  },
  markPublished: async (revision: number, at: string) => {
    const current = pages.get(orgId) as ({ record: R & { status?: string; publishedAt?: string }; revision: number; publishedRevision?: number | null; schedule?: PublicationSchedule | null } | undefined);
    if (!current) return;
    current.publishedRevision = revision;
    if (current.revision === revision && current.record.status === "approved") {
      current.record = { ...current.record, status: "published" };
      delete current.schedule;
    }
    if (current.revision === revision && !current.record.publishedAt) current.record = { ...current.record, publishedAt: at };
  },
  setSchedule: async (expectedRevision: number, schedule: PublicationSchedule | null, by: { id: string | null; name: string }, at: string) => {
    const current = pages.get(orgId) as ({ record: R & { status?: string }; revision: number; updatedAt: string; updatedBy: unknown; schedule?: PublicationSchedule | null } | undefined);
    if (!current || current.revision !== expectedRevision || current.record.status !== "approved") return null;
    Object.assign(current, { revision: expectedRevision + 1, updatedAt: at, updatedBy: by });
    if (schedule) current.schedule = structuredClone(schedule);
    else delete current.schedule;
    return structuredClone(current);
  },
  markScheduleFailed: async (scheduledAt: string, failedAt: string, problems: string[]) => {
    const current = pages.get(orgId) as ({ record: R & { status?: string }; schedule?: PublicationSchedule | null } | undefined);
    if (current?.record.status === "approved" && current.schedule?.at === scheduledAt) current.schedule = { ...current.schedule, failedAt, problems };
  },
});
export const memoryHomepageStore = (data: SharedData, orgId: string): HomepageStore => memoryBlockPageStore<Homepage>(data.homepages, orgId) as HomepageStore;

export const memoryDonationPageStore = (data: SharedData, orgId: string): DonationPageStore => ({
  get: async () => structuredClone(data.donationPages.get(orgId) ?? null),
  create: async (stored) => {
    if (stored.record.orgId !== orgId) throw new Error("Refusing to store a donation page for another organization");
    if (data.donationPages.has(orgId)) return false;
    data.donationPages.set(orgId, structuredClone(stored));
    return true;
  },
  replace: async (record: GeneralDonationPage, expectedRevision, by, at) => {
    if (record.orgId !== orgId) throw new Error("Refusing to store a donation page for another organization");
    const current = data.donationPages.get(orgId);
    if (!current || current.revision !== expectedRevision) return null;
    const next = { record: structuredClone(record), revision: expectedRevision + 1, updatedAt: at, updatedBy: by, publishedRevision: record.status === "archived" ? null : current.publishedRevision ?? null, ...(record.status === "approved" && current.schedule && { schedule: current.schedule }) };
    data.donationPages.set(orgId, next);
    return structuredClone(next);
  },
  markPublished: async (revision: number, at: string) => {
    const current = data.donationPages.get(orgId);
    if (!current) return;
    current.publishedRevision = revision;
    if (current.revision === revision && current.record.status === "approved") {
      current.record = { ...current.record, status: "published" };
      delete current.schedule;
    }
    if (current.revision === revision && !current.record.publishedAt) current.record = { ...current.record, publishedAt: at };
  },
  setSchedule: async (expectedRevision, schedule, by, at) => {
    const current = data.donationPages.get(orgId);
    if (!current || current.revision !== expectedRevision || current.record.status !== "approved") return null;
    Object.assign(current, { revision: expectedRevision + 1, updatedAt: at, updatedBy: by });
    if (schedule) current.schedule = structuredClone(schedule);
    else delete current.schedule;
    return structuredClone(current);
  },
  markScheduleFailed: async (scheduledAt, failedAt, problems) => {
    const current = data.donationPages.get(orgId);
    if (current?.record.status === "approved" && current.schedule?.at === scheduledAt) current.schedule = { ...current.schedule, failedAt, problems };
  },
});

export const memorySettingsStore = (data: SharedData, orgId: string): SettingsStore => ({
  get: async () => structuredClone(data.settings.get(orgId) ?? null),
  create: async (stored) => {
    if (stored.record.orgId !== orgId) throw new Error("Refusing to store settings for another organization");
    if (data.settings.has(orgId)) return false;
    data.settings.set(orgId, structuredClone(stored));
    return true;
  },
  replace: async (record: SiteSettings, expectedRevision, by, at) => {
    const current = data.settings.get(orgId);
    if (!current || current.revision !== expectedRevision) return null;
    const next = { record: structuredClone(record), revision: expectedRevision + 1, updatedAt: at, updatedBy: by };
    data.settings.set(orgId, next);
    return structuredClone(next);
  },
});

export const memoryPublishStore = (data: SharedData, orgId: string): PublishStore => {
  const state = () => {
    if (!data.publish.has(orgId)) data.publish.set(orgId, { lastVersion: 0, active: null, lockId: null, lockedUntil: 0 });
    return data.publish.get(orgId)!;
  };
  return {
    acquireLock: async (lockId, now, ttl) => {
      const s = state();
      if (s.lockId && s.lockedUntil > now.getTime()) return false;
      Object.assign(s, { lockId, lockedUntil: now.getTime() + ttl });
      return true;
    },
    releaseLock: async (lockId) => {
      const s = state();
      if (s.lockId === lockId) Object.assign(s, { lockId: null, lockedUntil: 0 });
    },
    nextVersion: async (lockId) => {
      const s = state();
      if (s.lockId !== lockId) throw new Error("The publish lock was lost");
      return ++s.lastVersion;
    },
    insertSnapshot: async (stored) => {
      if (stored.snapshot.organization.id !== orgId) throw new Error("Refusing to store a snapshot for another organization");
      data.snapshots.push({ orgId, activated: false, stored: structuredClone(stored) });
    },
    activate: async (lockId, info) => {
      const s = state();
      if (s.lockId !== lockId) return false;
      s.active = structuredClone(info);
      data.snapshots.find((x) => x.orgId === orgId && x.stored.version === info.version)!.activated = true;
      return true;
    },
    active: async () => structuredClone(state().active),
    setDeployment: async (version, deployment) => {
      const s = state();
      if (s.active?.version === version) s.active.deployment = structuredClone(deployment);
    },
    activeSnapshot: async () => {
      const active = state().active;
      return active ? structuredClone(data.snapshots.find((x) => x.orgId === orgId && x.stored.version === active.version)?.stored ?? null) : null;
    },
    snapshotByVersion: async (version) => {
      const active = state().active;
      if (!active || version > active.version) return null;
      return structuredClone(data.snapshots.find((x) => x.orgId === orgId && x.stored.version === version && x.activated)?.stored ?? null);
    },
  };
};

/* `provider`: the donation provider (a deterministic fake by default);
   null = not configured. */
export function harness(orgId = "org-a", data: SharedData = sharedData(), deploy: DeploymentTrigger = new NoDeploymentTrigger(), provider: DonationProvider | null = new FakeDonationProvider()) {
  const time = clock();
  const audit = new AuditService(memoryAuditStore(data.base, orgId), { orgId, secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const media = new MemoryMediaStore(data.media, orgId);
  const settingsStore = memorySettingsStore(data, orgId);
  const publishStore = memoryPublishStore(data, orgId);
  const lock = publishLock(publishStore, time.now);
  const postStore = new MemoryContentStore<Post & { title: string }>(data.posts, orgId, { types: ["news", "blog"] });
  const storyStore = new MemoryContentStore<Post & { title: string }>(data.posts, orgId, { types: ["story"] });
  const eventStore = new MemoryContentStore<Event>(data.events, orgId);
  const appealStore = new MemoryContentStore<Appeal>(data.appeals, orgId);
  const donationPageStore = memoryDonationPageStore(data, orgId);
  const homepageStore = memoryHomepageStore(data, orgId);
  const aboutStore = memoryBlockPageStore<About>(data.abouts as never, orgId);
  const teamStore = new MemoryContentStore<TeamMember>(data.team, orgId, { titleKey: "name" });
  const programStore = new MemoryContentStore<Program>(data.programs, orgId);
  const metricStore = new MemoryContentStore<Metric>(data.metrics, orgId, { titleKey: "label" });
  const reportStore = new MemoryContentStore<Report>(data.reports, orgId);
  const projectStore = new MemoryContentStore<Project>(data.projects, orgId);
  const impactStore = memoryBlockPageStore<Impact>(data.impacts as never, orgId);
  const transparencyStore = memoryBlockPageStore<Transparency>(data.transparencies as never, orgId);
  const careersStore = memoryBlockPageStore<Careers>(data.careers as never, orgId);
  const howWeWorkStore = memoryBlockPageStore<HowWeWork>(data.howWeWork as never, orgId);
  const policyStores = Object.fromEntries(POLICY_IDS.map((id) => [id, memoryBlockPageStore(data.policies[id] as never, orgId)])) as Record<PolicyId, never>;
  const policies = Object.fromEntries(POLICY_IDS.map((id) => [id, new PolicyService(id, policyStores[id], settingsStore, media, audit, { orgId, now: time.now, lock })])) as Record<PolicyId, PolicyService>;
  const getInvolvedStores = Object.fromEntries(GET_INVOLVED_PAGE_IDS.map((id) => [id, memoryBlockPageStore(data.getInvolved[id] as never, orgId)])) as Record<GetInvolvedPageId, never>;
  const announcementBarStore = memoryBlockPageStore(data.announcementBars as never, orgId);
  const popupStore = memoryBlockPageStore(data.popups as never, orgId);
  const storyStripStore = memoryBlockPageStore(data.storyStrips as never, orgId);
  const getInvolved = Object.fromEntries(GET_INVOLVED_PAGE_IDS.map((id) => [id, new GetInvolvedService(id, getInvolvedStores[id], media, audit, { orgId, now: time.now, lock })])) as Record<GetInvolvedPageId, GetInvolvedService>;
  const verify = checkoutVerifier(() => {
    if (!provider) throw new ProviderError("not-configured");
    return provider;
  });
  return {
    appeals: new ContentService(appealCollection(verify), appealStore, media, audit, { orgId, now: time.now, lock }),
    donationPage: new DonationPageService(donationPageStore, media, audit, verify, { orgId, now: time.now, lock }),
    homepage: new HomepageService(homepageStore, media, { posts: postStore, events: eventStore, appeals: appealStore }, audit, { orgId, now: time.now, lock }),
    about: new AboutService(aboutStore as never, media, audit, { orgId, now: time.now, lock }),
    team: new TeamService(teamStore, media, audit, { orgId, now: time.now, lock }),
    programs: new ProgramService(programStore, media, audit, { orgId, now: time.now, lock }),
    metrics: new MetricService(metricStore, media, audit, { orgId, now: time.now, lock }),
    reports: new ReportService(reportStore, media, audit, { orgId, now: time.now, lock }),
    impact: new ImpactService(impactStore as never, media, { stories: storyStore, programs: programStore }, audit, { orgId, now: time.now, lock }),
    stories: new StoryService(storyStore, media, { programs: programStore, projects: projectStore }, audit, { orgId, now: time.now, lock }),
    projects: new ProjectService(projectStore, media, { programs: programStore, stories: storyStore }, audit, { orgId, now: time.now, lock }),
    transparency: new TransparencyService(transparencyStore as never, media, audit, { orgId, now: time.now, lock }),
    careers: new CareersService(careersStore as never, media, audit, { orgId, now: time.now, lock }),
    howWeWork: new HowWeWorkService(howWeWorkStore as never, media, audit, { orgId, now: time.now, lock }),
    policies,
    policyDirectory: new PolicyDirectory(policies, settingsStore, orgId),
    getInvolved,
    getInvolvedDirectory: new GetInvolvedDirectory(getInvolved, orgId),
    announcementBar: new AnnouncementBarService(announcementBarStore as never, media, audit, { orgId, now: time.now, lock }),
    popup: new PopupService(popupStore as never, media, audit, { orgId, now: time.now, lock }),
    storyStrip: new StoryStripService(storyStripStore as never, appealStore as never, media, audit, { orgId, now: time.now, lock }),
    provider,
    posts: new ContentService(postCollection({ programs: programStore }), postStore, media, audit, { orgId, now: time.now, lock }),
    events: new ContentService(eventCollection({ programs: programStore }), eventStore, media, audit, { orgId, now: time.now, lock }),
    data,
    time,
    audit: data.base.audit,
    settings: new SettingsService(settingsStore, media, audit, { orgId, now: time.now }),
    publishing: new PublishService({ publish: publishStore, settings: settingsStore, media, posts: postStore, events: eventStore, appeals: appealStore, donationPage: donationPageStore, homepage: homepageStore, about: aboutStore as never, team: teamStore, programs: programStore, metrics: metricStore, reports: reportStore, impact: impactStore as never, transparency: transparencyStore as never, stories: storyStore, projects: projectStore, careers: careersStore as never, howWeWork: howWeWorkStore as never, forms: memoryFormDefinitionStore(data.formDefinitions, orgId), policies: policyStores, getInvolved: getInvolvedStores, announcementBar: announcementBarStore as never, popup: popupStore as never, storyStrip: storyStripStore as never }, audit, deploy, {
      orgId,
      log: silentLog,
      now: time.now,
      verifyCheckouts: verify,
    }),
    publishStore,
  };
}

/* A media record in the given state, straight into the shared rows. */
export function addMedia(data: SharedData, orgId: string, status: MediaRecord["status"], overrides: Partial<MediaRecord> = {}): MediaRecord {
  const at = "2026-10-01T00:00:00.000Z";
  const id = crypto.randomUUID();
  const record: MediaRecord = {
    id, orgId, status, kind: "image", objectKey: `${orgId}/media/${crypto.randomUUID()}/logo.png`,
    objectState: status === "deleted" ? "deleted" : "present",
    publicUrl: status === "ready" ? `https://media.test/${orgId}/media/x/logo.png` : null,
    originalFilename: "logo.png", mimeType: "image/png", size: 100, width: 128, height: 128,
    alt: "Logo", caption: "", credit: "", license: "", consent: "not-required",
    createdBy: "u", updatedBy: "u", createdAt: at, updatedAt: at, completedAt: status === "ready" ? at : null,
    failedAt: null, failureReason: null, deletedAt: null, deletedBy: null, version: 1, schemaVersion: 1, ...overrides,
  };
  data.media.push(record);
  return record;
}

/* Website forms as saved in the admin, in memory (organization-scoped). */
export function memoryFormDefinitionStore(rows: FormDefinition[], orgId: string) {
  const mine = () => rows.filter((d) => d.orgId === orgId);
  return {
    list: async () => mine().sort((a, b) => a.id.localeCompare(b.id)).map((d) => structuredClone(d)),
    get: async (id: string) => structuredClone(mine().find((d) => d.id === id) ?? null),
    save: async (d: FormDefinition) => {
      const i = rows.findIndex((r) => r.orgId === orgId && r.id === d.id);
      if (i === -1) rows.push(structuredClone(d));
      else rows[i] = structuredClone(d);
    },
    remove: async (id: string) => {
      const i = rows.findIndex((r) => r.orgId === orgId && r.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    },
  };
}
