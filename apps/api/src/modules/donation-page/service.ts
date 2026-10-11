import { unlocked, type PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { GeneralDonationPage } from "@rbb/content-schema";
import { errors } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import { checkoutToVerify, donationSectionProblems } from "../appeals/service.ts";
import { CONFLICT, changedFields, checkMedia, isLive, issuesOf, member } from "../content/shared.ts";
import { ACTION } from "../content/service.ts";
import { statusAfterEdit, transition, type EditorialStatus, type WorkflowAction } from "../content/workflow.ts";
import type { CheckoutVerifier } from "../donations/verify.ts";
import type { MediaStore } from "../media/repository.ts";
import { UNSCHEDULE, droppedBecause, newSchedule, notApproved, notScheduled, parseScheduleRequest, requireScheduler, scheduleView, type ScheduleView } from "../publishing/schedule.ts";
import type { DonationPageStore, StoredDonationPage } from "./repository.ts";

/* The general donation page — "give to the organization generally" — as
   the content contract's GeneralDonationPage. One per organization: there
   is no list, no create and no delete, only read and save.

     GET    the page, or { record: null, revision: 0 } before it exists
     PATCH  { revision, changes: { hero?, sections?, donation?, seo?, status? } }
            each change is a WHOLE part of the page; `seo: null` clears it.
            revision 0 creates the page (hero and donation required).

   Lifecycle: the editorial workflow, as every content record (M14,
   content/workflow.ts): POST /api/v1/donation-page/submit | withdraw
   (editors and owners) | approve | reject (owners). A save never
   publishes; an edit to an approved or published page makes it a draft
   again, its published version staying live. Only a page with a published
   version enters the snapshot; until then the website shows its own
   source donation page. PATCH { status: "archived" } archives it, and
   { status: "draft" } reopens it.

   The same rules as an appeal: contract, the blocks a donation page
   draws, ready media of this organization, and a Givebutter checkout
   verified with the provider whenever the page is published with a
   checkout the public has not had yet. Audited as donation_page.updated
   with field paths only. */

export const DONATION_PAGE_ID = "general-donation";

const STATUS = z.enum(["draft", "submitted", "approved", "published", "archived"]);
const UPDATE = z.strictObject({
  revision: z.int().min(0),
  changes: z.strictObject({
    hero: z.unknown().optional(),
    sections: z.unknown().optional(),
    donation: z.unknown().optional(),
    seo: z.unknown().optional(),
    status: STATUS.optional(),
  }),
});

export interface DonationPageView {
  record: GeneralDonationPage | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  live: boolean;
  /* M15: when the approved revision joins a website publish, or null. */
  schedule: ScheduleView | null;
}

export class DonationPageService {
  readonly #store: DonationPageStore;
  readonly #media: MediaStore;
  readonly #audit: AuditService;
  readonly #verify: CheckoutVerifier;
  readonly #orgId: string;
  readonly #now: () => Date;
  readonly #lock: PublishLock;

  constructor(store: DonationPageStore, media: MediaStore, audit: AuditService, verify: CheckoutVerifier, { orgId, now = () => new Date(), lock = unlocked }: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    this.#lock = lock;
    this.#store = store;
    this.#media = media;
    this.#audit = audit;
    this.#verify = verify;
    this.#orgId = orgId;
    this.#now = now;
  }

  #view(stored: StoredDonationPage | null, auth: AuthContext): DonationPageView {
    if (!stored) return { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null };
    return { record: stored.record, revision: stored.revision, updatedAt: stored.updatedAt, updatedBy: { name: stored.updatedBy.name, isYou: stored.updatedBy.id === auth.user.id }, live: isLive(stored), schedule: scheduleView(stored.schedule) };
  }

  async get(auth: AuthContext): Promise<DonationPageView> {
    member(auth, this.#orgId);
    return this.#view(await this.#store.get(), auth);
  }

  async update(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    member(auth, this.#orgId);
    const parsed = UPDATE.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { revision, changes } = parsed.data;
    const stored = await this.#store.get();
    if ((stored?.revision ?? 0) !== revision) throw errors.conflict(CONFLICT);

    const before = stored?.record ?? null;
    const now = this.#now().toISOString();
    if (!before) {
      const missing = (["hero", "donation"] as const).filter((k) => changes[k] === undefined || changes[k] === null);
      if (missing.length) throw errors.validation(missing.map((k) => ({ path: `body.changes.${k}`, message: "is required" })));
    }
    const { status: requested, ...content } = changes;
    const merged: Record<string, unknown> = {
      ...(before ?? { id: DONATION_PAGE_ID, orgId: this.#orgId, schemaVersion: 1, status: "draft", sections: [], createdAt: now }),
      ...Object.fromEntries(Object.entries(content).filter(([, v]) => v !== undefined)),
      updatedAt: now,
    };
    for (const [key, value] of Object.entries(content)) if (value === null) delete merged[key];
    const strip = (r: Record<string, unknown> | null) => JSON.stringify(r && { ...r, updatedAt: undefined, status: undefined });
    const contentChanged = !before || strip(before as unknown as Record<string, unknown>) !== strip(merged);
    merged.status =
      requested === "archived" && before
        ? "archived"
        : statusAfterEdit((before?.status as EditorialStatus | undefined) ?? null, requested, contentChanged, "donation page");

    const result = GeneralDonationPage.safeParse(merged);
    if (!result.success) throw errors.validation(issuesOf(result.error, ["body", "changes"]));
    const record = result.data;
    const refs: [string, string | undefined][] = [
      ["body.changes.hero.imageId", record.hero.imageId],
      ["body.changes.seo.ogImageId", record.seo?.ogImageId],
    ];
    const previousRefs = [before?.hero.imageId, before?.seo?.ogImageId];
    const problems = [
      ...donationSectionProblems(record.sections, "body.changes.sections"),
      ...(await checkMedia(this.#media, refs.filter(([, id], i) => id !== previousRefs[i]))),
    ];
    if (!problems.length) {
      const checkout = checkoutToVerify(record, before);
      if (checkout) problems.push(...(await this.#verify([{ path: "body.changes.donation.checkout", checkout }])));
    }
    if (problems.length) throw errors.validation(problems);

    const by = { id: auth.user.id, name: auth.user.name };
    const fields = changedFields(before ?? {}, record as unknown as Record<string, unknown>, ["sections"]).filter((f) => !["updatedAt", "publishedAt", "createdAt"].includes(f));
    let saved: StoredDonationPage | null;
    if (!before) {
      if (!(await this.#store.create({ record, revision: 1, updatedAt: now, updatedBy: by }))) throw errors.conflict(CONFLICT);
      saved = await this.#store.get();
    } else {
      if (!fields.length) return this.#view(stored, auth);
      saved = await this.#store.replace(record, revision, by, now);
      if (!saved) throw errors.conflict(CONFLICT);
    }
    await this.#audit.recordSafely(
      { action: "donation_page.updated", resourceType: "donation_page", resourceId: record.id, actorUserId: auth.user.id, metadata: { fields, status: record.status, created: !before } },
      facts
    );
    if (stored && saved) await this.#dropped(auth, stored, saved, droppedBecause(record.status), facts);
    return this.#view(saved, auth);
  }

  /* M14: a workflow transition of the revision the member has open.
     Submitting and approving check the page again — its sections, every
     image, and (when approving) its Givebutter checkout with the provider. */
  async act(auth: AuthContext, action: WorkflowAction, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    member(auth, this.#orgId);
    const parsed = ACTION.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound("donation page");
    if (stored.revision !== parsed.data.revision) throw errors.conflict(CONFLICT);
    const from = stored.record.status as EditorialStatus;
    const { to, past } = transition(auth, action, from, "donation page");
    const now = this.#now().toISOString();
    const record = { ...stored.record, status: to, updatedAt: now } as GeneralDonationPage;
    if (to !== "draft") {
      const problems = [
        ...donationSectionProblems(record.sections, "body.sections"),
        ...(await checkMedia(this.#media, [["body.hero.imageId", record.hero.imageId], ["body.seo.ogImageId", record.seo?.ogImageId]])),
      ];
      problems.push(...(await this.#checkout(record, stored.record, problems)));
      if (problems.length) throw errors.validation(problems);
    }
    const saved = await this.#store.replace(record, stored.revision, { id: auth.user.id, name: auth.user.name }, now);
    if (!saved) throw errors.conflict(CONFLICT);
    await this.#audit.recordSafely({ action: `donation_page.${past}`, resourceType: "donation_page", resourceId: record.id, actorUserId: auth.user.id, metadata: { from, to, revision: saved.revision } }, facts);
    await this.#dropped(auth, stored, saved, "rejected", facts);
    return this.#view(saved, auth);
  }

  async #checkout(record: GeneralDonationPage, before: GeneralDonationPage, problems: { path: string; message: string }[]) {
    const checkout = !problems.length && checkoutToVerify(record, before);
    return checkout ? this.#verify([{ path: "body.donation.checkout", checkout }]) : [];
  }

  /* M15: schedule the APPROVED page's website publication (owners) —
     holding the publish lock (publishing/lock.ts), as unscheduling does. */
  schedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    return this.#lock.exclusive(() => this.#schedule(auth, input, facts));
  }
  unschedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    return this.#lock.exclusive(() => this.#unschedule(auth, input, facts));
  }

  async #schedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const now = this.#now();
    const request = parseScheduleRequest(input, now);
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound("donation page");
    if (stored.revision !== request.revision) throw errors.conflict(CONFLICT);
    if (stored.record.status !== "approved") throw notApproved("donation page", stored.record.status);
    const record = stored.record;
    const problems = [...donationSectionProblems(record.sections, "body.sections"), ...(await checkMedia(this.#media, [["body.hero.imageId", record.hero.imageId], ["body.seo.ogImageId", record.seo?.ogImageId]]))];
    if (problems.length) throw errors.validation(problems);
    const schedule = newSchedule(request, record, stored.revision + 1, auth, now);
    const saved = await this.#store.setSchedule(stored.revision, schedule, { id: auth.user.id, name: auth.user.name }, now.toISOString());
    if (!saved) throw await this.#lost(request.revision);
    await this.#audit.recordSafely({ action: "donation_page.scheduled", resourceType: "donation_page", resourceId: record.id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: schedule.at, timeZone: schedule.timeZone, ...(stored.schedule && { previousAt: stored.schedule.at }) } }, facts);
    return this.#view(saved, auth);
  }

  /* M15: drop the page's schedule (owners); it stays approved. */
  async #unschedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<DonationPageView> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const parsed = UNSCHEDULE.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound("donation page");
    if (stored.revision !== parsed.data.revision) throw errors.conflict(CONFLICT);
    if (!stored.schedule) throw notScheduled("donation page");
    const saved = await this.#store.setSchedule(stored.revision, null, { id: auth.user.id, name: auth.user.name }, this.#now().toISOString());
    if (!saved) throw await this.#lost(parsed.data.revision);
    await this.#audit.recordSafely({ action: "donation_page.unscheduled", resourceType: "donation_page", resourceId: stored.record.id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: stored.schedule.at, reason: "owner" } }, facts);
    return this.#view(saved, auth);
  }

  async #lost(revision: number) {
    const now = await this.#store.get();
    return !now || now.revision !== revision ? errors.conflict(CONFLICT) : notApproved("donation page", now.record.status);
  }

  async #dropped(auth: AuthContext, before: StoredDonationPage, after: StoredDonationPage, reason: string, facts: RequestFacts) {
    if (!before.schedule || after.schedule) return;
    await this.#audit.recordSafely({ action: "donation_page.unscheduled", resourceType: "donation_page", resourceId: after.record.id, actorUserId: auth.user.id, metadata: { revision: after.revision, at: before.schedule.at, reason } }, facts);
  }
}
