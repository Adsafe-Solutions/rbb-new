import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PASSWORD_RULES,
  ROLE_HELP,
  actionsFor,
  fieldProblems,
  memberProblems,
  messageFor,
  newPasswordProblems,
  readSetupToken,
  roleLabel,
  setupLinkFor,
} from "../../src/users/rules.ts";
import { PASSWORD_POLICY } from "../../../api/src/modules/auth/password.ts";
import { ROLES } from "../../../api/src/modules/auth/types.ts";

/* M17.3: the team and account rules as the admin applies them. The API
   enforces all of them; these must never offer what it would refuse, and
   must agree with its policy. */

const TOKEN = "Ab3_-".repeat(8) + "xyz"; // 43 base64url characters
const member = (over = {}) => ({ isYou: false, status: "active", passwordSet: true, activeSessions: 0, ...over });

test("the admin's password rule and roles are the API's", () => {
  assert.deepEqual(PASSWORD_RULES, { minLength: PASSWORD_POLICY.minLength, maxLength: PASSWORD_POLICY.maxLength });
  assert.deepEqual(Object.keys(ROLE_HELP).sort(), [...ROLES].sort());
  assert.deepEqual([roleLabel("OWNER"), roleLabel("EDITOR")], ["Owner", "Editor"]);
});

test("setup links: the token goes in the fragment, and only a well-formed token is read back", () => {
  assert.equal(TOKEN.length, 43);
  const link = setupLinkFor("https://admin.example/", TOKEN);
  assert.equal(link, `https://admin.example/setup-password#token=${TOKEN}`);
  const url = new URL(link);
  assert.equal(url.search, "", "nothing in the query string — the part a browser sends");
  assert.equal(readSetupToken(url.hash), TOKEN);
  assert.equal(readSetupToken(`#foo=1&token=${TOKEN}`), TOKEN);
  for (const hash of ["", "#", "#token=", `token=${TOKEN}`, "#token=short", `#token=${TOKEN}x`, `#token=${TOKEN.slice(0, 42)}!`, `#tok=${TOKEN}`, "#token=%3Cscript%3E"])
    assert.equal(readSetupToken(hash), null, JSON.stringify(hash));
});

test("actions: never on yourself; reactivate only when deactivated; setup link only without a password; sign-out only with sessions", () => {
  assert.deepEqual(actionsFor(member({ isYou: true })), []);
  assert.deepEqual(actionsFor(member({ isYou: true, passwordSet: false, activeSessions: 3 })), []);
  assert.deepEqual(actionsFor(member({ status: "disabled" })), ["reactivate"]);
  assert.deepEqual(actionsFor(member({ status: "disabled", passwordSet: false, activeSessions: 2 })), ["reactivate"]);
  assert.deepEqual(actionsFor(member()), ["role", "deactivate"]);
  assert.deepEqual(actionsFor(member({ passwordSet: false })), ["role", "setupLink", "deactivate"]);
  assert.deepEqual(actionsFor(member({ activeSessions: 2 })), ["role", "revokeSessions", "deactivate"]);
});

test("new passwords: the API's length rule, matching confirmation, and different from the current one", () => {
  assert.deepEqual(newPasswordProblems("a long enough pass", "a long enough pass"), {});
  assert.deepEqual(Object.keys(newPasswordProblems("short", "short")), ["password"]);
  assert.deepEqual(Object.keys(newPasswordProblems("x".repeat(12), "x".repeat(12))), []);
  assert.deepEqual(Object.keys(newPasswordProblems("x".repeat(257), "x".repeat(257))), ["password"]);
  assert.deepEqual(Object.keys(newPasswordProblems("a long enough pass", "a long enough pas")), ["confirm"]);
  assert.match(newPasswordProblems("my current long password", "my current long password", "my current long password").password, /different/);
});

test("add-member input: a name and a plausible email, before anything is sent", () => {
  assert.deepEqual(memberProblems({ name: "Ada", email: "ada@example.org" }), {});
  assert.deepEqual(Object.keys(memberProblems({ name: "  ", email: "" })).sort(), ["email", "name"]);
  for (const email of ["ada", "ada@", "ada@example", "a da@example.org", `${"a".repeat(250)}@example.org`]) assert.ok(memberProblems({ name: "Ada", email }).email, email);
  assert.ok(memberProblems({ name: "x".repeat(121), email: "ada@example.org" }).name);
});

test("API errors: the API's own words for 4xx, ours for throttling, outages and an ended session", () => {
  assert.equal(messageFor({ status: 409, message: "This is the organization's last active owner." }), "This is the organization's last active owner.");
  assert.equal(messageFor({ status: 429, message: "Too many requests.", retryAfterSeconds: 61 }), "Too many attempts. Try again in about 2 minutes.");
  assert.equal(messageFor({ status: 429, message: "x", retryAfterSeconds: null }), "Too many attempts. Try again in about 1 minute.");
  assert.match(messageFor({ status: 0, message: "x" }), /could not be reached/);
  assert.match(messageFor({ status: 503, message: "internal detail" }), /could not be reached/);
  assert.match(messageFor({ status: 401, message: "x" }), /session has ended/);
  assert.equal(messageFor(new Error("boom"), "Fallback."), "Fallback.");
});

test("field problems: VALIDATION_ERROR details mapped to the form's fields, never values", () => {
  assert.deepEqual(fieldProblems({ status: 400, message: "", details: [{ path: "currentPassword", message: "is incorrect" }] }), { currentPassword: "This is incorrect." });
  assert.deepEqual(fieldProblems({ status: 400, message: "", details: [{ path: "newPassword", message: "must be at least 12 characters" }] }), { newPassword: "It must be at least 12 characters." });
  assert.deepEqual(fieldProblems({ status: 400, message: "", details: [{ path: "body.email", message: "Invalid email address" }] }), { email: "Invalid email address." });
  assert.deepEqual(fieldProblems({ status: 409, message: "x" }), {});
  assert.deepEqual(fieldProblems(null), {});
});
