import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldCodesFrom } from "../../src/lib/formResponse.js";

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
