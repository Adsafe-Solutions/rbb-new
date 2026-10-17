import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldCodesFrom, registrationOutcome } from "../../src/lib/formResponse.js";

/* M18: the field codes a form reads from a 422 — the API's error envelope
   or the old form server's shape — and nothing else. */

test("the API's envelope (M18): fields.<name> → code", () => {
  const body = { error: { code: "UNPROCESSABLE_CONTENT", message: "Some fields need attention.", details: [
    { path: "fields.name", message: "required" },
    { path: "fields.email", message: "format" },
    { path: "fields.message", message: "too-long" },
    { path: "fields.topic", message: "invalid" },
  ] } };
  assert.deepEqual(fieldCodesFrom(body), { name: "required", email: "format", message: "too-long", topic: "invalid" });
});

test("the old form server's shape still works (until it is retired)", () => {
  assert.deepEqual(fieldCodesFrom({ ok: false, error: "invalid", fields: { email: "format", consent: "required" } }), { email: "format", consent: "required" });
});

test("only known codes and plain field names; never wording; anything else is empty", () => {
  const body = { error: { details: [
    { path: "fields.name", message: "<b>Your name is wrong</b>" },
    { path: "fields.__proto__", message: "required" },
    { path: "body.email", message: "required" },
    { path: "fields.email", message: "format" },
    { path: 7, message: "required" },
  ] } };
  assert.deepEqual(fieldCodesFrom(body), { email: "format" });
  for (const nothing of [null, undefined, "x", 42, {}, { error: { details: "x" } }, { fields: ["required"] }]) assert.deepEqual(fieldCodesFrom(nothing), {});
});

test("field ids the admin builds (lowercase, digits, underscores) come through", () => {
  const body = { error: { details: [
    { path: "fields.dietary_needs", message: "required" },
    { path: "fields.guest2", message: "invalid" },
    { path: "fields.arrival_date", message: "format" },
    { path: "fields._private", message: "required" },
    { path: "fields.Upper", message: "required" },
    { path: `fields.a${"b".repeat(40)}`, message: "required" },
  ] } };
  assert.deepEqual(fieldCodesFrom(body), { dietary_needs: "required", guest2: "invalid", arrival_date: "format" });
});

test("an event registration's 409: full or closed, from the envelope's details; anything else is an error", () => {
  const conflict = (message) => ({ error: { code: "CONFLICT", message: "No.", details: [{ path: "registration", message }] } });
  assert.equal(registrationOutcome(conflict("full")), "full");
  assert.equal(registrationOutcome(conflict("closed")), "closed");
  assert.equal(registrationOutcome(conflict("something else")), "error");
  assert.equal(registrationOutcome({ error: { code: "CONFLICT", details: [{ path: "fields.name", message: "full" }] } }), "error");
  for (const nothing of [null, undefined, "x", {}, { error: {} }, { error: { details: "full" } }]) assert.equal(registrationOutcome(nothing), "error");
});
