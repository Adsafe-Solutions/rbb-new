import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@rbb/content-schema";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { loadFormsConfig, type FormsConfig } from "../src/modules/forms/config.ts";
import type { EmailTransport, OutgoingEmail } from "../src/modules/forms/email.ts";
import { memoryPlaceStore } from "../src/modules/forms/places.ts";
import { FormService, registrationClosesAt } from "../src/modules/forms/service.ts";
import { SubmissionService } from "../src/modules/submissions/service.ts";
import type { StoredSubmission } from "../src/modules/submissions/repository.ts";
import { clock, memoryAuditStore, memoryAuthStores, memoryData, silentLog } from "./auth/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";

/* Event registration (2026-10-17) at the service level: taken against the
   event AS PUBLISHED, refused when closed, ended or full (the place limit
   holds under concurrency), stored always, RBB's events inbox told when it
   is set, and the registrant sent a confirmation that quotes nothing they
   typed. No real email: every transport here records. */

const EVENT_ID = "evt-football-0001";
const FORM_ID = `event-${EVENT_ID}`;
const FIELDS: NonNullable<Event["registration"]>["fields"] = [
  { id: "name", type: "text", label: "Your full name", required: true },
  { id: "email", type: "email", label: "Email address", required: true },
  { id: "position", type: "radio", label: "Position", required: true, options: ["Goalkeeper", "Defender", "Forward"] },
  { id: "days", type: "checkboxes", label: "Days you can play", required: false, options: ["Saturday", "Sunday"] },
  { id: "guests", type: "number", label: "Guests", required: false, min: 0, max: 3 },
  { id: "born", type: "date", label: "Date of birth", required: false },
  { id: "rules", type: "checkbox", label: "I agree to the match rules", required: true },
  { id: "marketing", type: "checkbox", label: "News by email", required: false, defaultChecked: true },
];

const event = (registration: Partial<NonNullable<Event["registration"]>> | null = {}): Event =>
  ({
    id: EVENT_ID,
    orgId: "org-a",
    schemaVersion: 1,
    status: "published",
    slug: "football-game",
    title: "Football Game",
    summary: "Brotherhood football game",
    about: [],
    date: "2026-10-17",
    startTime: "8:30 PM",
    endTime: "10:00 PM",
    timezone: "Asia/Kolkata",
    programId: null,
    venue: "Facility B, Tiger 5",
    address: "Dairy Circle, Bengaluru",
    mapUrl: "https://maps.example.org/facility-b",
    schedule: [],
    imageId: "media-1",
    ...(registration && { registration: { open: true, submitLabel: "Register", successMessage: "You're registered.", fields: FIELDS, ...registration } }),
  }) as unknown as Event;

const REGISTRANT = { name: "Ravi <b>Player</b>", email: "ravi.player@example.org", position: "Defender", days: ["Sunday", "Saturday"], guests: "2", born: "1999-02-28", rules: true, marketing: false };
const body = (fields: Record<string, unknown> = REGISTRANT, extra: Record<string, unknown> = {}) => ({ formId: FORM_ID, fields, website: "", elapsedMs: 5000, antiSpamToken: null, ...extra });
const facts = (ip = "198.51.100.9") => ({ requestId: "req-reg-0001", clientIp: ip, idempotencyKey: "abcdef12-3456" });
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;

function world({ config = loadFormsConfig({ EMAIL_MODE: "test", EMAIL_TO_EVENTS: "events-inbox@rbb.example" }), live = event() as Event | null, rows = [] as StoredSubmission[], failInsert = false, at = "2026-10-15T10:00:00.000Z" }: { config?: FormsConfig; live?: Event | null; rows?: StoredSubmission[]; failInsert?: boolean; at?: string } = {}) {
  const data = memoryData();
  const time = clock(at);
  const audit = new AuditService(memoryAuditStore(data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const captured: OutgoingEmail[] = [];
  const places = memoryPlaceStore();
  const submissions = memorySubmissionStore(rows, "org-a", { failInsert });
  const transport: EmailTransport = async () => ({ ok: true, id: "fake" });
  const service = new FormService(memoryAuthStores(data, "org-a").throttle, audit, {
    orgId: "org-a",
    config: { ...config, rateLimit: { max: 50, windowMs: 600_000 } },
    secret: "test-only-auth-secret-0123456789abcdef",
    transport,
    log: silentLog,
    now: time.now,
    capture: (email) => captured.push(email),
    submissions,
    events: { live: async (id) => (live && live.id === id ? live : null) },
    places,
    siteOrigin: "https://www.rbb.example",
  });
  const outcomes = () => data.audit.filter((e) => e.action === "forms.submission").map((e) => e.metadata.outcome);
  return { service, captured, rows, places, outcomes, time, data, submissions };
}

test("a registration is stored with its labels, RBB's events inbox is told, and the registrant gets the event's details", async () => {
  const w = world();
  const { reference } = await w.service.submit(FORM_ID, body(), facts());
  assert.match(reference, /^RBB-/);
  assert.equal(w.rows.length, 1);
  const row = w.rows[0]!;
  assert.equal(row.formId, FORM_ID);
  assert.equal(row.formTitle, "Registration — Football Game");
  assert.equal(row.labels?.position, "Position");
  // Choose any: in the form's order, whatever order they were ticked in.
  assert.deepEqual({ position: row.fields.position, days: row.fields.days, guests: row.fields.guests, born: row.fields.born, rules: row.fields.rules, marketing: row.fields.marketing }, { position: "Defender", days: "Saturday; Sunday", guests: "2", born: "1999-02-28", rules: "Yes", marketing: "No" });

  assert.equal(w.captured.length, 2);
  const [notify, confirm] = w.captured;
  assert.equal(notify!.to, "events-inbox@rbb.example");
  assert.equal(notify!.replyTo, REGISTRANT.email);
  assert.match(notify!.subject, /^New submission: Registration — Football Game · RBB-/);
  assert.equal(confirm!.to, REGISTRANT.email);
  assert.match(confirm!.subject, /^You're registered: Football Game · RBB-/);
  for (const part of ["Football Game", "Saturday, 17 October 2026", "8:30 PM – 10:00 PM (Asia/Kolkata)", "Facility B, Tiger 5", "https://www.rbb.example/media/events/football-game", "https://maps.example.org/facility-b", reference]) assert.ok(confirm!.text.includes(part), part);
  // The confirmation quotes nothing the registrant typed — not even their name.
  for (const typed of ["Ravi", "Player", "Defender", "1999"]) assert.ok(!confirm!.html.includes(typed) && !confirm!.text.includes(typed), typed);
  assert.deepEqual(w.outcomes(), ["stored_and_delivered"]);
});

test("without an events inbox the registration is stored and only the confirmation is sent; with email off, nothing is sent", async () => {
  const quiet = world({ config: loadFormsConfig({ EMAIL_MODE: "test" }) });
  await quiet.service.submit(FORM_ID, body(), facts());
  assert.deepEqual(quiet.captured.map((e) => e.to), [REGISTRANT.email]);

  const off = world({ config: loadFormsConfig({}) });
  await off.service.submit(FORM_ID, body(), facts());
  assert.equal(off.rows.length, 1);
  assert.equal(off.captured.length, 0);
  assert.deepEqual(off.outcomes(), ["stored"]);
});

test("answers are checked against the published registration form: choices, numbers, dates and the agreement", async () => {
  const w = world();
  const codes = async (fields: Record<string, unknown>) => (await failure(w.service.submit(FORM_ID, body({ ...REGISTRANT, ...fields }), facts()))).details?.map((d) => `${d.path}:${d.message}`);
  assert.deepEqual(await codes({ position: "Striker" }), ["fields.position:invalid"]);
  assert.deepEqual(await codes({ position: "" }), ["fields.position:required"]);
  assert.deepEqual(await codes({ days: ["Monday"] }), ["fields.days:invalid"]);
  assert.deepEqual(await codes({ guests: "4" }), ["fields.guests:invalid"]);
  assert.deepEqual(await codes({ guests: "two" }), ["fields.guests:format"]);
  assert.deepEqual(await codes({ born: "1999-02-30" }), ["fields.born:format"]);
  assert.deepEqual(await codes({ rules: false }), ["fields.rules:required"]);
  assert.equal((await failure(w.service.submit(FORM_ID, body({ ...REGISTRANT, days: "Sunday" }), facts()))).code, "BAD_REQUEST");
  assert.equal(w.rows.length, 0);
  assert.equal(w.places.taken.get(FORM_ID) ?? 0, 0, "an invalid registration takes no place");
});

test("the place limit holds — also when several people take the last places at once", async () => {
  const w = world({ live: event({ capacity: 2 }) });
  const results = await Promise.allSettled([1, 2, 3, 4].map((n) => w.service.submit(FORM_ID, body({ ...REGISTRANT, email: `p${n}@example.org` }), facts(`198.51.100.${n}`))));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason as ApiError);
  assert.equal(refused.length, 2);
  for (const e of refused) {
    assert.equal(e.code, "CONFLICT");
    assert.deepEqual(e.details, [{ path: "registration", message: "full" }]);
  }
  assert.equal(w.rows.length, 2);
  assert.equal(w.outcomes().filter((o) => o === "registration_full").length, 2);
});

test("a limit added later counts the registrations already stored", async () => {
  const stored = (n: number): StoredSubmission => ({ id: `00000000-0000-4000-8000-00000000000${n}`, orgId: "org-a", formId: FORM_ID, reference: `RBB-OLD${n}`, fields: { name: "A", email: `a${n}@example.org` }, status: "new", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" });
  const w = world({ live: event({ capacity: 2 }), rows: [stored(1), stored(2)] });
  assert.deepEqual((await failure(w.service.submit(FORM_ID, body(), facts()))).details, [{ path: "registration", message: "full" }]);
});

test("a closed form, an ended event, an unpublished event or one without a form refuses", async () => {
  const closed = world({ live: event({ open: false }) });
  assert.deepEqual((await failure(closed.service.submit(FORM_ID, body(), facts()))).details, [{ path: "registration", message: "closed" }]);
  assert.deepEqual(closed.outcomes(), ["registration_closed"]);

  // 10:00 PM in Kolkata on the 17th is 16:30 UTC; a minute's grace, then closed.
  const ended = world({ at: "2026-10-17T16:31:30.000Z" });
  assert.deepEqual((await failure(ended.service.submit(FORM_ID, body(), facts()))).details, [{ path: "registration", message: "closed" }]);
  const lastMinute = world({ at: "2026-10-17T16:30:30.000Z" });
  await lastMinute.service.submit(FORM_ID, body(), facts());

  assert.equal((await failure(world({ live: null }).service.submit(FORM_ID, body(), facts()))).code, "NOT_FOUND");
  assert.equal((await failure(world({ live: event(null) }).service.submit(FORM_ID, body(), facts()))).code, "NOT_FOUND");
  assert.equal((await failure(world().service.submit(FORM_ID, body(REGISTRANT, { formId: "contact" }), facts()))).code, "BAD_REQUEST");
});

test("a bot gets the same answer and takes no place; a registration that cannot be stored gives its place back", async () => {
  const w = world({ live: event({ capacity: 1 }) });
  await w.service.submit(FORM_ID, body(REGISTRANT, { website: "spam" }), facts());
  assert.equal(w.rows.length, 0);
  assert.equal(w.places.taken.get(FORM_ID) ?? 0, 0);

  const broken = world({ live: event({ capacity: 1 }), failInsert: true });
  assert.equal((await failure(broken.service.submit(FORM_ID, body(), facts()))).code, "SERVICE_UNAVAILABLE");
  assert.equal(broken.places.taken.get(FORM_ID), 0);
  assert.equal(broken.captured.length, 0);
});

test("deleting a registration in the admin gives its place back", async () => {
  const w = world({ live: event({ capacity: 1 }) });
  await w.service.submit(FORM_ID, body(), facts());
  assert.equal(w.places.taken.get(FORM_ID), 1);
  const admin = new SubmissionService(w.submissions, new AuditService(memoryAuditStore(w.data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog }), { places: w.places });
  const owner = { user: { id: "u-owner", name: "Owner" }, role: "OWNER", permissions: ["submissions:read", "submissions:write"] };
  await admin.remove(owner as never, w.rows[0]!.id, { requestId: null, clientIp: null, userAgent: null });
  assert.equal(w.places.taken.get(FORM_ID), 0);
  await w.service.submit(FORM_ID, body(), facts());
});

test("registration closes when the event ends, in its own time zone", () => {
  assert.equal(new Date(registrationClosesAt({ date: "2026-10-17", startTime: "8:30 PM", endTime: "10:00 PM", timezone: "Asia/Kolkata" })).toISOString(), "2026-10-17T16:31:00.000Z");
  assert.equal(new Date(registrationClosesAt({ date: "2026-10-17", startTime: "8:30 PM", timezone: "Europe/London" })).toISOString(), "2026-10-17T23:00:00.000Z");
});
