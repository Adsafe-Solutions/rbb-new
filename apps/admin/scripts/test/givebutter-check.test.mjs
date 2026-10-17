import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* The Givebutter campaign check names WHICH of the API's four 503s
   happened (2026-10-17): no key, a refused key, busy, or no answer. The
   messages are read from the API's own source, so a change there that
   the admin no longer recognises fails here instead of falling back to a
   vague line in production. */

const { campaignCheckMessage } = await import("../../src/donations/checkMessage.ts");
const api = readFileSync(new URL("../../../api/src/modules/donations/routes.ts", import.meta.url), "utf8");
const said = (needle) => api.match(new RegExp(`"(The donation provider ${needle}[^"]*)"`))?.[1];

test("each of the API's 503 messages gets its own explanation", () => {
  const cases = [
    [said("is not configured\\."), /no Givebutter API key.*GIVEBUTTER_API_KEY/],
    [said("is not configured correctly"), /refused the server's API key/],
    [said("is busy"), /busy/],
    [said("is unavailable"), /did not answer/],
  ];
  for (const [message, want] of cases) {
    assert.ok(message, "the API still says it");
    assert.match(campaignCheckMessage(503, message), want, message);
  }
});

test("other answers keep their own lines", () => {
  assert.match(campaignCheckMessage(404, ""), /no campaign with this ID/);
  assert.match(campaignCheckMessage(400, ""), /digits only/);
  assert.match(campaignCheckMessage(503, "Something new"), /could not be reached/);
  assert.match(campaignCheckMessage(0, ""), /server could not be reached/);
});
