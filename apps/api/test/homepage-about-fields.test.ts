import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* Milestone 8 — the homepage and About fields the website now draws:
   the line and link of "programs" and "get involved", the line of
   "timeline" and "stories", the approach's and an appeal list's highlight
   (homepage); a statement's link, mission and vision's highlight, the
   values' intro and the approach's highlight (About). The contract always
   held them; validated, stored, kept, cleared and published, in memory.
   Test records only. */

const owner = member("org-a", "OWNER");
const block = (id: string, type: string, data: Record<string, unknown>) => ({ id, type, enabled: true, version: 1, data });
const LINK = { label: "See every program", href: "/work" };
const HOME = [
  block("programs", "programs", { kicker: "Our work", heading: "Four areas of work", body: "A test line under the programs.", cta: LINK }),
  block("approach", "approach", { heading: "How we work together", highlight: "together", body: "A test statement." }),
  block("timeline", "timeline", { heading: "Our progress", body: "A test line under the timeline.", items: [] }),
  block("stories", "stories", { heading: "Stories of change", body: "A test line under the stories.", count: 3 }),
  block("get-involved", "getInvolved", { heading: "Ways to take part", body: "A test line under the ways in.", cta: { label: "All the ways", href: "/get-involved" }, imageIds: {} }),
  block("appeals", "appealList", { heading: "Appeals open now", highlight: "now" }),
];
const ABOUT = [
  block("intro", "pageHero", { title: "About a test organization", body: "A test line." }),
  block("who-we-are", "statement", { heading: "Who we are", body: ["A test paragraph."], cta: { label: "Our story", href: "/about/team" } }),
  block("mission-vision", "missionVision", { heading: "What guides us", highlight: "guides", mission: { label: "Our Mission", statement: "A test mission." }, vision: { label: "Our Vision", statement: "A test vision." } }),
  block("values", "numberedCards", { heading: "Our values", intro: "A test introduction to the values.", items: [{ title: "A test value" }] }),
  block("how-we-work", "approach", { heading: "How we work", highlight: "work" }),
];
const rejects = async (promise: Promise<unknown>, path: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    assert.ok(error.details?.some((d) => d.path === path || d.path.startsWith(`${path}.`)), `${path}: ${JSON.stringify(error.details)}`);
    return true;
  });
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  return { h, image };
}
const without = (sections: ReturnType<typeof block>[], type: string, ...keys: string[]) =>
  sections.map((s) => (s.type === type ? { ...s, data: Object.fromEntries(Object.entries(s.data).filter(([k]) => !keys.includes(k))) } : s));

test("homepage: stored as written; kept when an update leaves the sections out; cleared by leaving a field out of the block", async () => {
  const { h } = await site();
  const created = await h.homepage.create(owner, { sections: HOME }, FACTS);
  assert.deepEqual(created.record!.sections, HOME);
  const kept = await h.homepage.update(owner, { revision: created.revision, changes: { seo: { title: "A test title" } } }, FACTS);
  assert.deepEqual(kept.record!.sections, HOME, "kept");
  const cleared = await h.homepage.update(owner, { revision: kept.revision, changes: { sections: without(without(HOME, "programs", "body", "cta"), "approach", "highlight") } }, FACTS);
  const programs = cleared.record!.sections.find((s) => s.type === "programs")!.data as Record<string, unknown>;
  assert.ok(!("body" in programs) && !("cta" in programs), "a block's fields are the block as sent");
  assert.ok(!("highlight" in cleared.record!.sections.find((s) => s.type === "approach")!.data));
});

test("About: stored as written; kept; cleared", async () => {
  const { h } = await site();
  const created = await h.about.create(owner, { sections: ABOUT }, FACTS);
  assert.deepEqual(created.record!.sections, ABOUT);
  const kept = await h.about.update(owner, { revision: created.revision, changes: { seo: { title: "A test title" } } }, FACTS);
  assert.deepEqual(kept.record!.sections, ABOUT);
  const cleared = await h.about.update(owner, { revision: kept.revision, changes: { sections: without(without(ABOUT, "statement", "cta"), "numberedCards", "intro") } }, FACTS);
  assert.ok(!("cta" in cleared.record!.sections.find((s) => s.type === "statement")!.data));
  assert.ok(!("intro" in cleared.record!.sections.find((s) => s.type === "numberedCards")!.data));
});

test("refused by name: a highlight not in its heading, a line too long, an unsafe link, an intro too long", async () => {
  const { h } = await site();
  const set = (type: string, extra: Record<string, unknown>) => HOME.map((s) => (s.type === type ? { ...s, data: { ...s.data, ...extra } } : s));
  await rejects(h.homepage.create(owner, { sections: set("approach", { highlight: "elsewhere" }) }, FACTS), "body.sections.1.data.highlight");
  await rejects(h.homepage.create(owner, { sections: set("programs", { body: "x".repeat(601) }) }, FACTS), "body.sections.0.data.body");
  await rejects(h.homepage.create(owner, { sections: set("getInvolved", { cta: { label: "Bad", href: "javascript:alert(1)" } }) }, FACTS), "body.sections.4.data.cta.href");
  await rejects(h.homepage.create(owner, { sections: set("appealList", { highlight: "later" }) }, FACTS), "body.sections.5.data.highlight");
  const about = (type: string, extra: Record<string, unknown>) => ABOUT.map((s) => (s.type === type ? { ...s, data: { ...s.data, ...extra } } : s));
  await rejects(h.about.create(owner, { sections: about("missionVision", { highlight: "values" }) }, FACTS), "body.sections.2.data.highlight");
  await rejects(h.about.create(owner, { sections: about("numberedCards", { intro: "x".repeat(401) }) }, FACTS), "body.sections.3.data.intro");
  await rejects(h.about.create(owner, { sections: about("statement", { cta: { label: "", href: "/about" } }) }, FACTS), "body.sections.1.data.cta.label");
});

test("blocks saved without the fields — every page before Milestone 8 — stay valid, editable and approvable", async () => {
  const { h } = await site();
  const plainHome = without(without(without(without(without(without(HOME, "programs", "body", "cta"), "timeline", "body"), "stories", "body"), "getInvolved", "body", "cta"), "approach", "highlight"), "appealList", "highlight");
  await h.homepage.create(owner, { sections: plainHome }, FACTS);
  assert.equal((await approvePage(h.homepage, owner, FACTS)).record!.status, "approved");
  const plainAbout = without(without(without(without(ABOUT, "statement", "cta"), "missionVision", "highlight"), "numberedCards", "intro"), "approach", "highlight");
  await h.about.create(owner, { sections: plainAbout }, FACTS);
  assert.equal((await approvePage(h.about, owner, FACTS)).record!.status, "approved");
});

test("published: every field reaches the snapshot as written", async () => {
  const { h } = await site();
  await h.homepage.create(owner, { sections: HOME }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  await h.about.create(owner, { sections: ABOUT }, FACTS);
  await approvePage(h.about, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.homepage!.sections, HOME);
  assert.deepEqual(snapshot.content.about!.sections, ABOUT);
});
