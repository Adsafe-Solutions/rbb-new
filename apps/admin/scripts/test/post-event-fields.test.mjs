import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOG_CATEGORIES, typeChange } from "../../src/content/postFields.ts";
import { minutesOf, scheduleProblems, zoneOptions } from "../../src/content/eventFields.ts";
import { BLOG_CATEGORY_IDS, Event } from "../../../../packages/content-schema/src/index.ts";

/* Milestone 4: the editors' news program, blog category, event program,
   schedule and time zone. The helpers mirror the contract so problems
   show beside the field; the contract (and the API) stay the rule. */

const src = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("blog categories: the contract's ids, with the website's names", () => {
  assert.deepEqual(BLOG_CATEGORIES.map((c) => c.value), [...BLOG_CATEGORY_IDS]);
  const web = readFileSync(new URL("../../../web/src/content/media.js", import.meta.url), "utf8");
  const block = /export const BLOG_CATEGORIES = \[([\s\S]*?)\];/.exec(web)[1];
  const named = [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)" \}/g)].map(([, value, label]) => ({ value, label }));
  assert.deepEqual(BLOG_CATEGORIES, named, "the labels the website shows");
});

test("a type switch clears the field only the old type has — never kept unseen", () => {
  assert.deepEqual(typeChange("blog"), { type: "blog", programId: undefined });
  assert.deepEqual(typeChange("news"), { type: "news", category: undefined });
  assert.ok("programId" in typeChange("blog") && "category" in typeChange("news"), "named, so the save sends null");
});

test("schedule problems agree with the contract, case for case", () => {
  const base = { id: "e", orgId: "rbb", schemaVersion: 1, status: "draft", slug: "e", title: "E", summary: "S.", about: [], date: "2026-11-14", programId: null, venue: "V", address: "A", imageId: "m" };
  const cases = [
    ["6:30 PM", "9:00 PM", []],
    ["6:30 PM", "9:00 PM", [{ time: "6:30 PM", item: "Welcome" }, { item: "Main" }, { time: "9:00 PM", item: "Close" }]],
    ["6:30 PM", "9:00 PM", [{ time: "6:29 PM", item: "Early" }]],
    ["6:30 PM", "9:00 PM", [{ time: "9:01 PM", item: "Late" }]],
    ["6:30 PM", "9:00 PM", [{ time: "8:00 PM", item: "B" }, { item: "between" }, { time: "7:00 PM", item: "A" }]],
    ["6:30 PM", undefined, [{ time: "11:59 PM", item: "Late, no end" }]],
    ["12:00 AM", "11:59 PM", [{ time: "12:00 AM", item: "Open" }, { time: "11:59 PM", item: "Close" }]],
    ["11:00 AM", "1:00 PM", [{ time: "12:00 PM", item: "Noon" }, { time: "12:30 PM", item: "After noon" }]],
    ["6:30 PM", "9:00 PM", [{ time: "7:00 PM", item: "" }]],
  ];
  for (const [startTime, endTime, schedule] of cases) {
    const result = Event.safeParse({ ...base, startTime, ...(endTime && { endTime }), schedule });
    const contract = new Set(result.success ? [] : result.error.issues.filter((i) => i.path[0] === "schedule").map((i) => `${i.path[1]}.${i.path[2]}`));
    const mirrored = new Set([...scheduleProblems(startTime, endTime, schedule)].flatMap(([i, p]) => [p.time && `${i}.time`, p.item && `${i}.item`].filter(Boolean)));
    assert.deepEqual(mirrored, contract, JSON.stringify(schedule));
  }
  assert.deepEqual([minutesOf("12:00 AM"), minutesOf("12:00 PM"), minutesOf("11:59 PM"), minutesOf("18:30")], [0, 720, 1439, NaN]);
});

test("time zones: the runtime's list plus UTC, and the event's own zone shown as stored — never the browser's zone", () => {
  const supported = ["Asia/Calcutta", "Europe/London"];
  const values = (current) => zoneOptions(current, supported).map((o) => o.value);
  assert.deepEqual(values(undefined), ["", "Asia/Calcutta", "Europe/London", "UTC"]);
  assert.deepEqual(values("Asia/Kolkata"), ["", "Asia/Calcutta", "Asia/Kolkata", "Europe/London", "UTC"], "a stored spelling the list lacks is offered as it is");
  assert.equal(zoneOptions(undefined, supported)[0].label, "Choose a time zone", "nothing is chosen for the editor");
  for (const file of ["content/eventFields.ts", "pages/events/EventEditorPage.tsx"]) assert.doesNotMatch(src(file), /resolvedOptions\(\)|getTimezoneOffset/, `${file} never reads the browser's zone`);
});

test("the editors offer the new fields and send them", () => {
  const post = src("pages/posts/PostEditorPage.tsx");
  assert.match(post, /const FIELDS = \[[^\]]*"category"[^\]]*"programId"/);
  assert.match(post, /<ProgramSelect [^>]*value=\{d\.programId\}/, "news: the program");
  assert.match(post, /label="Category"/, "blog: the category");
  assert.match(post, /editor\.set\(typeChange\(/, "the type switch clears the other type's field");
  const event = src("pages/events/EventEditorPage.tsx");
  assert.match(event, /const FIELDS = \[[^\]]*"programId", "schedule"/);
  assert.match(event, /<ProgramSelect [^>]*onChange=\{\(programId\) => editor\.set\(\{ programId: programId \?\? null \}\)\}/, "None is open to all (null)");
  assert.match(event, /<ItemList<ScheduleStep>/, "the schedule");
  assert.match(event, /max=\{SCHEDULE_MAX\}/);
});
