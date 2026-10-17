import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOG_CATEGORY_IDS, Event, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Milestone 4 — an event's schedule and time zone, and a blog post's
   category, as the contract states them. Times are wall-clock values on
   the event's own day, never converted. */

const ok = (value: unknown) => {
  const r = Event.safeParse(value);
  assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues));
};
const fails = (value: unknown, path: (string | number)[], message?: RegExp) => {
  const r = Event.safeParse(value);
  assert.ok(!r.success, `expected a failure at ${path.join(".")}`);
  const issue = r.error.issues.find((i) => i.path.join(".") === path.join("."));
  assert.ok(issue, JSON.stringify(r.error.issues));
  if (message) assert.match(issue.message, message);
};

test("time zone: absent is allowed (the website's own events state none); present, it is a real IANA zone", () => {
  ok({ ...fx.event(), timezone: undefined });
  for (const zone of ["Europe/London", "Asia/Kolkata", "Asia/Calcutta", "Asia/Kathmandu", "America/Argentina/Buenos_Aires", "America/Toronto", "UTC"]) ok({ ...fx.event(), timezone: zone });
  for (const zone of ["IST", "EST", "PST8PDT", "GMT+5", "+05:30", "Mars/Olympus_Mons", "", "europe london"]) fails({ ...fx.event(), timezone: zone }, ["timezone"]);
});

test("times are wall-clock values on one day: midnight and the last minute are boundaries, an end at or before the start is refused", () => {
  ok({ ...fx.event(), startTime: "12:00 AM", endTime: "11:59 PM", schedule: [] });
  ok({ ...fx.event(), startTime: "11:59 AM", endTime: "12:00 PM", schedule: [] });
  fails({ ...fx.event(), startTime: "12:00 PM", endTime: "11:59 AM", schedule: [] }, ["endTime"]);
  fails({ ...fx.event(), startTime: "9:00 PM", endTime: "1:00 AM", schedule: [] }, ["endTime"], /after the start/);
  for (const time of ["13:00 PM", "0:30 AM", "6:30PM", "6:30 pm", "18:30", "6:60 PM"]) fails({ ...fx.event(), startTime: time, schedule: [] }, ["startTime"]);
  for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "26-11-14"]) fails({ ...fx.event(), date }, ["date"]);
  ok({ ...fx.event(), date: "2028-02-29" });
});

test("a start a daylight-saving change skips is refused in that zone, never moved; a repeated hour is kept as written", () => {
  // America/New_York, 8 March 2026: 2:00 AM → 3:00 AM. 1 November 2026: 1:00–2:00 AM happens twice.
  const early = { ...fx.event(), endTime: "4:00 AM", schedule: [] };
  fails({ ...early, date: "2026-03-08", startTime: "2:30 AM", timezone: "America/New_York" }, ["startTime"], /does not happen in America\/New_York/);
  ok({ ...early, date: "2026-03-08", startTime: "2:30 AM", timezone: "Asia/Kolkata" });
  ok({ ...early, date: "2026-03-08", startTime: "2:30 AM" });
  ok({ ...early, date: "2026-11-01", startTime: "1:30 AM", timezone: "America/New_York" });
  ok({ ...early, date: "2026-03-08", startTime: "3:00 AM", timezone: "America/New_York" });
});

test("a schedule: optional times, within the event, in order; untimed steps sit anywhere", () => {
  ok({ ...fx.event(), schedule: [] });
  ok({ ...fx.event(), schedule: [{ time: "6:30 PM", item: "Welcome" }, { item: "Main session" }, { time: "9:00 PM", item: "Close" }] });
  ok({ ...fx.event(), endTime: undefined, schedule: [{ time: "6:30 PM", item: "Welcome" }, { time: "11:00 PM", item: "Late" }] });
  fails({ ...fx.event(), schedule: [{ time: "6:00 PM", item: "Early" }] }, ["schedule", 0, "time"], /before the event starts/);
  fails({ ...fx.event(), schedule: [{ time: "9:01 PM", item: "Late" }] }, ["schedule", 0, "time"], /after the event ends/);
  fails({ ...fx.event(), schedule: [{ time: "8:00 PM", item: "B" }, { item: "between" }, { time: "7:00 PM", item: "A" }] }, ["schedule", 2, "time"], /before the step above/);
  fails({ ...fx.event(), schedule: [{ time: "", item: "Blank time" }] }, ["schedule", 0, "time"]);
  fails({ ...fx.event(), schedule: [{ time: "7:00 PM" }] }, ["schedule", 0, "item"]);
  fails({ ...fx.event(), schedule: Array.from({ length: 21 }, () => ({ item: "Step" })) }, ["schedule"]);
});

test("program: a program's slug, or null for an event open to all", () => {
  ok({ ...fx.event(), programId: "education" });
  ok({ ...fx.event(), programId: null });
  fails({ ...fx.event(), programId: "Not A Slug" }, ["programId"]);
});

test("the snapshot: a blog post's category, when it has one, is a blog category", () => {
  const snapshot = (news: Record<string, unknown>[], blogs: Record<string, unknown>[]) => ({
    version: 1,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: "rbb" },
    settings: fx.settings(),
    media: {},
    content: { news, blogs },
  });
  const blog = (category?: string) => ({ ...fx.post(), imageId: undefined, ...(category === undefined ? { category: undefined } : { category }) });
  const news = (extra: Record<string, unknown> = {}) => ({ ...fx.post(), id: "n1", slug: "n1", type: "news", category: undefined, imageId: undefined, ...extra });
  const paths = (value: unknown) => {
    const r = PublishedSnapshot.safeParse(value);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };
  for (const id of BLOG_CATEGORY_IDS) assert.deepEqual(paths(snapshot([], [blog(id)])), [], id);
  assert.deepEqual(paths(snapshot([], [blog()])), [], "a blog post without a category");
  assert.deepEqual(paths(snapshot([], [blog("field")])), ["content.blogs.0.category"], "a story category is not a blog category");
  assert.deepEqual(paths(snapshot([news()], [])), []);
});

test("registration (2026-10-17): a form on the event's page with a required name and email, an optional place limit, never with a registration link", () => {
  const form = { open: true, submitLabel: "Register", successMessage: "You're registered.", fields: [{ id: "name", type: "text", label: "Your full name", required: true }, { id: "email", type: "email", label: "Email address", required: true }, { id: "position", type: "radio", label: "Position", required: true, options: ["Goalkeeper", "Defender"] }, { id: "days", type: "checkboxes", label: "Days", required: false, options: ["Sat", "Sun"] }, { id: "guests", type: "number", label: "Guests", required: false, min: 0, max: 3 }, { id: "born", type: "date", label: "Born", required: false }] };
  ok({ ...fx.event(), registration: form });
  ok({ ...fx.event(), registration: { ...form, capacity: 40 } });
  ok({ ...fx.event(), registration: { ...form, open: false }, registrationUrl: "https://tickets.example.org/e" });
  fails({ ...fx.event(), registration: form, registrationUrl: "https://tickets.example.org/e" }, ["registrationUrl"]);
  fails({ ...fx.event(), registration: { ...form, capacity: 0 } }, ["registration", "capacity"]);
  fails({ ...fx.event(), registration: { ...form, fields: form.fields.slice(1) } }, ["registration", "fields"], /"name"/);
  fails({ ...fx.event(), registration: { ...form, fields: [...form.fields, { id: "cv", type: "file", label: "CV", required: false }] } }, ["registration", "fields", 6, "type"]);
  fails({ ...fx.event(), registration: { ...form, fields: [...form.fields.slice(0, 2), { id: "pick", type: "radio", label: "Pick", required: true }] } }, ["registration", "fields", 2, "options"]);
  fails({ ...fx.event(), registration: { ...form, fields: [...form.fields.slice(0, 2), { id: "n", type: "number", label: "N", required: false, min: 5, max: 1 }] } }, ["registration", "fields", 2, "max"]);
  fails({ ...fx.event(), registration: { ...form, fields: [...form.fields.slice(0, 2), { id: "d", type: "date", label: "D", required: false, placeholder: "dd/mm" }] } }, ["registration", "fields", 2, "placeholder"]);
  fails({ ...fx.event(), registration: { ...form, fields: [...form.fields.slice(0, 2), { id: "t", type: "text", label: "T", required: false, min: 1 }] } }, ["registration", "fields", 2, "min"]);
});
