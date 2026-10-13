import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NO_FILTERS, fieldRows, formLabel, replyHref, submissionsQuery, topicLabel } from "../../src/submissions/format.ts";

/* Form submissions in the admin (owners only): request, labels, reply. */

test("the request carries only the filters that are set", () => {
  assert.equal(submissionsQuery(NO_FILTERS), "");
  assert.equal(submissionsQuery({ ...NO_FILTERS, form: "partner", status: "new", q: "  acme  " }), "?form=partner&status=new&q=acme");
  assert.equal(submissionsQuery({ ...NO_FILTERS, from: "2026-10-01", to: "2026-10-13" }, "abc"), "?from=2026-10-01&to=2026-10-13&before=abc");
});

test("forms, topics and fields read as the website words them", () => {
  assert.deepEqual(["contact", "volunteer", "partner", "other"].map(formLabel), ["Contact Us", "Volunteer", "Partner With Us", "other"]);
  assert.equal(topicLabel("general"), "A general question");
  assert.deepEqual(fieldRows({ message: "Hello", email: "a@b.example", name: "A", topic: "donate", organization: "" }).map((r) => [r.label, r.value]), [["Name", "A"], ["Email", "a@b.example"], ["Topic", "Donate"], ["Message", "Hello"]]);
  assert.deepEqual(fieldRows({ marketing: "Yes", consent: "Yes", email: "r@b.example" }).map((r) => [r.label, r.value]), [["Email", "r@b.example"], ["Marketing emails", "Yes"], ["Newsletter consent", "Yes"]]);
  assert.equal(formLabel("newsletter"), "Newsletter");
});

test("a reply opens the member's own mail program, addressed, with the reference", () => {
  assert.equal(replyHref("asha@test.example", "contact", "RBB-ABC"), "mailto:asha@test.example?subject=Re%3A%20your%20Contact%20Us%20message%20(RBB-ABC)");
});

test("the screen is owners-only and in the Engagement section", () => {
  const routes = readFileSync(new URL("../../src/routes.tsx", import.meta.url), "utf8");
  assert.match(routes, /path: "\/submissions".*permission: "submissions:read"/);
  const nav = readFileSync(new URL("../../src/shell/navigation.ts", import.meta.url), "utf8");
  assert.match(nav, /id: "submissions".*href: "\/submissions", permission: "submissions:read"/);
});

test("reply from the admin: a composer that sends through the API, the replies sent, and the mail-app fallback", () => {
  const page = readFileSync(new URL("../../src/pages/submissions/SubmissionsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /submissionsApi\.reply\(item\.id, draft\)/);
  assert.match(page, />\s*Send reply\s*</);
  assert.match(page, /Replies sent/);
  assert.match(page, /Open in mail app/);
  assert.match(page, /replies cannot be sent from here yet/, "without email, says so and offers the mail app");
  const client = readFileSync(new URL("../../src/submissions/client.ts", import.meta.url), "utf8");
  assert.match(client, /\/replies`, \{ method: "POST"/);
});
