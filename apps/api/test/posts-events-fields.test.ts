import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOG_CATEGORY_IDS, PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, createApproved } from "./support/workflow.ts";

/* Milestone 4 — the News, Blog and Event fields the CMS lacked: a news
   item's program, a blog post's category, an event's program and schedule,
   and the event time-zone contract. Validated, stored, kept, cleared and
   published, in memory. Test records only. */

const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const rejects = async (promise: Promise<unknown>, path: string, message?: RegExp) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    const detail = error.details?.find((d) => d.path === path || d.path.startsWith(`${path}.`));
    assert.ok(detail, `${path}: ${JSON.stringify(error.details)}`);
    if (message) assert.match(detail.message, message);
    return true;
  });
const news = (o: Record<string, unknown> = {}) => ({ type: "news", title: "A test news item", body, ...o });
const blog = (o: Record<string, unknown> = {}) => ({ type: "blog", title: "A test blog post", body, ...o });
const event = (imageId: string, o: Record<string, unknown> = {}) => ({
  title: "A test gathering",
  summary: "A test summary.",
  about: body,
  date: "2026-11-14",
  startTime: "6:30 PM",
  endTime: "9:00 PM",
  timezone: "Europe/London",
  venue: "Test hall",
  address: "1 Test Street",
  imageId,
  ...o,
});
const program = (slug: string) => ({ title: `Test ${slug}`, slug, icon: "education", description: "A test line." });

async function site({ programs = [] as string[], approved = true } = {}) {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  for (const slug of programs) approved ? await createApproved(h.programs, owner, program(slug), FACTS) : await h.programs.create(owner, program(slug), FACTS);
  return { data, h, image };
}

/* ---------------- News: program ---------------- */

test("news: the program is stored, kept when an update leaves it out, changed, and cleared with null", async () => {
  const { h } = await site({ programs: ["education", "livelihoods"] });
  const created = await h.posts.create(owner, news({ programId: "education" }), FACTS);
  assert.equal(created.record.programId, "education");
  const kept = await h.posts.update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test title" } }, FACTS);
  assert.equal(kept.record.programId, "education", "kept");
  const changed = await h.posts.update(owner, created.record.id, { revision: kept.revision, changes: { programId: "livelihoods" } }, FACTS);
  assert.equal(changed.record.programId, "livelihoods");
  const cleared = await h.posts.update(owner, created.record.id, { revision: changed.revision, changes: { programId: null } }, FACTS);
  assert.ok(!("programId" in cleared.record), "cleared: absent, as before the field existed");
});

test("news: the program is checked server-side — unknown, archived, malformed; approval needs it approved; never a category", async () => {
  const { h } = await site({ programs: ["education"] });
  await rejects(h.posts.create(owner, news({ programId: "no-such-program" }), FACTS), "body.programId", /does not exist in this organization/);
  await rejects(h.posts.create(owner, news({ programId: "Not A Slug" }), FACTS), "body.programId");
  const archived = await h.programs.create(owner, program("archived-area"), FACTS);
  await h.programs.archive(owner, archived.record.id, FACTS);
  await rejects(h.posts.create(owner, news({ programId: "archived-area" }), FACTS), "body.programId", /archived/);
  await h.programs.create(owner, program("draft-area"), FACTS);
  const draft = await h.posts.create(owner, news({ programId: "draft-area" }), FACTS);
  assert.equal(draft.record.programId, "draft-area", "a draft may name a draft program");
  await assert.rejects(approve(h.posts, owner, draft.record.id, FACTS), (e: unknown) => e instanceof ApiError && Boolean(e.details?.some((d) => d.path === "body.programId" && /not approved yet/.test(d.message))));
  await rejects(h.posts.create(owner, news({ category: "reflections" }), FACTS), "body.category", /news has no category/);
});

test("news: with no program managed in the CMS yet, a program is the website's own by its address (the website build checks it)", async () => {
  const { h } = await site();
  const created = await h.posts.create(owner, news({ programId: "education" }), FACTS);
  assert.equal(created.record.programId, "education");
});

/* ---------------- Blogs: category ---------------- */

test("blogs: every blog category is stored; kept, changed, cleared; anything else refused by name", async () => {
  const { h } = await site({ programs: ["education"] });
  for (const category of BLOG_CATEGORY_IDS) assert.equal((await h.posts.create(owner, blog({ category, slug: `blog-${category}` }), FACTS)).record.category, category);
  const created = await h.posts.create(owner, blog({ category: "reflections" }), FACTS);
  const kept = await h.posts.update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test title" } }, FACTS);
  assert.equal(kept.record.category, "reflections", "kept");
  const changed = await h.posts.update(owner, created.record.id, { revision: kept.revision, changes: { category: "how-to" } }, FACTS);
  assert.equal(changed.record.category, "how-to");
  const cleared = await h.posts.update(owner, created.record.id, { revision: changed.revision, changes: { category: null } }, FACTS);
  assert.ok(!("category" in cleared.record), "cleared: listed under All only, as a post without one always was");
  for (const category of ["field", "news", "Reflections", "unknown-category"]) await rejects(h.posts.create(owner, blog({ category }), FACTS), "body.category", category === "Reflections" ? undefined : /must be one of reflections, field-notes, how-to/);
  await rejects(h.posts.create(owner, blog({ programId: "education" }), FACTS), "body.programId", /only news items/);
});

test("changing a post's type: the other type's field must be cleared in the same save — never kept unseen", async () => {
  const { h } = await site({ programs: ["education"] });
  const item = await h.posts.create(owner, news({ programId: "education" }), FACTS);
  await rejects(h.posts.update(owner, item.record.id, { revision: item.revision, changes: { type: "blog" } }, FACTS), "body.programId");
  const switched = await h.posts.update(owner, item.record.id, { revision: item.revision, changes: { type: "blog", programId: null, category: "field-notes" } }, FACTS);
  assert.deepEqual([switched.record.type, switched.record.programId, switched.record.category], ["blog", undefined, "field-notes"]);
});

test("posts saved without the new fields — every post before Milestone 4 — stay valid and editable, the fields absent", async () => {
  const { h } = await site({ programs: ["education"] });
  for (const input of [news(), blog()]) {
    const created = await h.posts.create(owner, input, FACTS);
    assert.ok(!("programId" in created.record) && !("category" in created.record));
    const edited = await h.posts.update(owner, created.record.id, { revision: created.revision, changes: { excerpt: "A test excerpt." } }, FACTS);
    assert.ok(!("programId" in edited.record) && !("category" in edited.record), "an unrelated edit adds nothing");
    await approve(h.posts, owner, created.record.id, FACTS);
  }
});

/* ---------------- Events: program, schedule, time zone ---------------- */

test("events: program and schedule are stored as written, kept when left out, and cleared to 'open to all' and 'no schedule'", async () => {
  const { h, image } = await site({ programs: ["education"] });
  const schedule = [{ time: "6:30 PM", item: "Welcome and introductions" }, { item: "Main session" }, { time: "9:00 PM", item: "Close" }];
  const created = await h.events.create(owner, event(image.id, { programId: "education", schedule }), FACTS);
  assert.deepEqual([created.record.programId, created.record.schedule], ["education", schedule]);
  const kept = await h.events.update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test gathering" } }, FACTS);
  assert.deepEqual([kept.record.programId, kept.record.schedule], ["education", schedule], "kept");
  const cleared = await h.events.update(owner, created.record.id, { revision: kept.revision, changes: { programId: null, schedule: null } }, FACTS);
  assert.deepEqual([cleared.record.programId, cleared.record.schedule], [null, []], "null: open to all, no schedule — the contract's own empty values");
  await approve(h.events, owner, created.record.id, FACTS);
});

test("events: the program is checked like a news item's; a malformed or out-of-range schedule is refused by step", async () => {
  const { h, image } = await site({ programs: ["education"] });
  await rejects(h.events.create(owner, event(image.id, { programId: "no-such-program" }), FACTS), "body.programId", /does not exist/);
  await rejects(h.events.create(owner, event(image.id, { schedule: [{ time: "6:00 PM", item: "Too early" }] }), FACTS), "body.schedule.0.time", /before the event starts/);
  await rejects(h.events.create(owner, event(image.id, { schedule: [{ time: "9:30 PM", item: "Too late" }] }), FACTS), "body.schedule.0.time", /after the event ends/);
  await rejects(h.events.create(owner, event(image.id, { schedule: [{ time: "8:00 PM", item: "B" }, { time: "7:00 PM", item: "A" }] }), FACTS), "body.schedule.1.time", /before the step above/);
  await rejects(h.events.create(owner, event(image.id, { schedule: [{ time: "19:00", item: "A" }] }), FACTS), "body.schedule.0.time");
  await rejects(h.events.create(owner, event(image.id, { schedule: [{ time: "7:00 PM" }] }), FACTS), "body.schedule.0.item");
  await rejects(h.events.create(owner, event(image.id, { schedule: Array.from({ length: 21 }, () => ({ item: "A step" })) }), FACTS), "body.schedule");
  /* Moving the times so a stored step falls outside the event is refused too. */
  const created = await h.events.create(owner, event(image.id, { schedule: [{ time: "6:30 PM", item: "Welcome" }] }), FACTS);
  await rejects(h.events.update(owner, created.record.id, { revision: created.revision, changes: { startTime: "7:00 PM" } }, FACTS), "body.schedule.0.time");
});

test("time zones: any real IANA name — the current and the older spellings — and nothing else; never cleared", async () => {
  const { h, image } = await site();
  /* "Asia/Kolkata" and "America/Argentina/Buenos_Aires" were refused before
     Milestone 4: the runtime's list of zones holds only their older names. */
  for (const timezone of ["Asia/Kolkata", "Asia/Calcutta", "Asia/Kathmandu", "Europe/Kyiv", "America/Argentina/Buenos_Aires", "America/Toronto", "UTC"]) {
    const created = await h.events.create(owner, event(image.id, { timezone, slug: `e-${timezone.toLowerCase().replace(/[^a-z]+/g, "-")}` }), FACTS);
    assert.equal(created.record.timezone, timezone, "stored as chosen, never canonicalised");
  }
  for (const timezone of ["IST", "EST", "PST8PDT", "GMT+5", "+05:30", "Mars/Olympus_Mons", "europe london", ""]) await rejects(h.events.create(owner, event(image.id, { timezone }), FACTS), "body.timezone");
  await rejects(h.events.create(owner, event(image.id, { timezone: undefined }), FACTS), "body.timezone", /is required/);
  const created = await h.events.create(owner, event(image.id), FACTS);
  await rejects(h.events.update(owner, created.record.id, { revision: created.revision, changes: { timezone: null } }, FACTS), "body.timezone", /is required/);
});

test("local times are preserved: stored and published exactly as written, whatever the zone — a skipped start is refused, never moved", async () => {
  const { h, image } = await site();
  const early = { date: "2026-03-08", startTime: "2:30 AM", endTime: "4:00 AM" };
  await rejects(h.events.create(owner, event(image.id, { ...early, timezone: "America/New_York" }), FACTS), "body.startTime", /does not happen in America\/New_York on 2026-03-08/);
  const india = await h.events.create(owner, event(image.id, { ...early, timezone: "Asia/Kolkata", slug: "india", schedule: [{ time: "2:30 AM", item: "Start" }] }), FACTS);
  assert.deepEqual([india.record.date, india.record.startTime, india.record.endTime, india.record.schedule[0]!.time], ["2026-03-08", "2:30 AM", "4:00 AM", "2:30 AM"]);
  const repeated = await h.events.create(owner, event(image.id, { date: "2026-11-01", startTime: "1:30 AM", endTime: "3:00 AM", timezone: "America/New_York", slug: "repeated" }), FACTS);
  assert.equal(repeated.record.startTime, "1:30 AM", "an hour that happens twice is kept as written");
  const boundaries = await h.events.create(owner, event(image.id, { startTime: "12:00 AM", endTime: "11:59 PM", timezone: "Pacific/Kiritimati", slug: "boundaries", schedule: [{ time: "12:00 AM", item: "Open" }, { time: "11:59 PM", item: "Close" }] }), FACTS);
  for (const v of [india, repeated, boundaries]) await approve(h.events, owner, v.record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  const bySlug = new Map(snapshot.content.events!.map((e) => [e.slug, e]));
  assert.deepEqual(
    ["india", "repeated", "boundaries"].map((s) => [bySlug.get(s)!.date, bySlug.get(s)!.startTime, bySlug.get(s)!.endTime, bySlug.get(s)!.timezone]),
    [["2026-03-08", "2:30 AM", "4:00 AM", "Asia/Kolkata"], ["2026-11-01", "1:30 AM", "3:00 AM", "America/New_York"], ["2026-11-14", "12:00 AM", "11:59 PM", "Pacific/Kiritimati"]]
  );
  assert.deepEqual(bySlug.get("boundaries")!.schedule, [{ time: "12:00 AM", item: "Open" }, { time: "11:59 PM", item: "Close" }]);
});

test("events saved without a program or schedule — every event before Milestone 4 — stay open to all with no schedule", async () => {
  const { h, image } = await site({ programs: ["education"] });
  const created = await h.events.create(owner, event(image.id), FACTS);
  assert.deepEqual([created.record.programId, created.record.schedule], [null, []]);
  const edited = await h.events.update(owner, created.record.id, { revision: created.revision, changes: { subtitle: "A test subtitle." } }, FACTS);
  assert.deepEqual([edited.record.programId, edited.record.schedule], [null, []]);
});

/* ---------------- Publishing ---------------- */

test("publishing: the new fields reach the snapshot; drafts and archived records stay out (the Milestone 1 presence rule)", async () => {
  const { h, image } = await site({ programs: ["education"] });
  await createApproved(h.posts, owner, news({ slug: "live-news", programId: "education" }), FACTS);
  await createApproved(h.posts, owner, blog({ slug: "live-blog", category: "field-notes" }), FACTS);
  const schedule = [{ time: "6:30 PM", item: "Welcome" }, { item: "Main session" }];
  await createApproved(h.events, owner, event(image.id, { slug: "live-event", programId: "education", schedule, timezone: "Asia/Kolkata" }), FACTS);
  await h.posts.create(owner, news({ slug: "draft-news", programId: "education" }), FACTS);
  await h.posts.create(owner, blog({ slug: "draft-blog", category: "how-to" }), FACTS);
  await h.events.create(owner, event(image.id, { slug: "draft-event", programId: "education" }), FACTS);
  const gone = await createApproved(h.events, owner, event(image.id, { slug: "archived-event" }), FACTS);
  await h.events.archive(owner, gone.record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.news!.map((p) => [p.slug, p.programId]), [["live-news", "education"]]);
  assert.deepEqual(snapshot.content.blogs!.map((p) => [p.slug, p.category]), [["live-blog", "field-notes"]]);
  assert.deepEqual(snapshot.content.events!.map((e) => [e.slug, e.programId, e.schedule, e.timezone]), [["live-event", "education", schedule, "Asia/Kolkata"]]);
  assert.ok(snapshot.content.programs!.some((p) => p.slug === "education"), "the program it names is published with it");
});

test("events: a registration form (2026-10-17) is stored whole, replaced whole, cleared with null — never alongside a registration link", async () => {
  const { h, image } = await site();
  const registration = { open: true, capacity: 30, submitLabel: "Register", successMessage: "You're registered.", fields: [{ id: "name", type: "text", label: "Your full name", required: true }, { id: "email", type: "email", label: "Email address", required: true }, { id: "position", type: "radio", label: "Position", required: true, options: ["Goalkeeper", "Defender"] }] };
  const created = await h.events.create(owner, event(image.id, { registration }), FACTS);
  assert.deepEqual(created.record.registration, registration);
  const closed = await h.events.update(owner, created.record.id, { revision: created.revision, changes: { registration: { ...registration, open: false, capacity: undefined } } }, FACTS);
  assert.deepEqual(closed.record.registration, { ...registration, open: false, capacity: undefined });
  await rejects(h.events.update(owner, created.record.id, { revision: closed.revision, changes: { registration, registrationUrl: "https://tickets.example.org/e" } }, FACTS), "body.registrationUrl", /not both/);
  await rejects(h.events.update(owner, created.record.id, { revision: closed.revision, changes: { registration: { ...registration, fields: [{ id: "name", type: "text", label: "Name", required: true }, { id: "cv", type: "file", label: "CV", required: false }] } } }, FACTS), "body.registration.fields");
  const switched = await h.events.update(owner, created.record.id, { revision: closed.revision, changes: { registration: null, registrationUrl: "https://tickets.example.org/e" } }, FACTS);
  assert.equal(switched.record.registration, undefined);
  assert.equal(switched.record.registrationUrl, "https://tickets.example.org/e");
  await approve(h.events, owner, created.record.id, FACTS);
});
