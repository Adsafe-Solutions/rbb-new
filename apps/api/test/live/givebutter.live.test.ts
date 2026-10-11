import { test } from "node:test";
import assert from "node:assert/strict";
import { GivebutterClient } from "../../src/modules/donations/givebutter/client.ts";
import { GivebutterProvider } from "../../src/modules/donations/givebutter/provider.ts";
import { checkoutVerifier } from "../../src/modules/donations/verify.ts";

/* LIVE: checkout verification against the real Givebutter account, with
   GIVEBUTTER_API_KEY from the environment and the campaign to check in
   LIVE_GIVEBUTTER_CAMPAIGN_ID (pnpm api:test:givebutter). Skipped when
   either is absent.

   READ-ONLY: it reads one campaign, never writes anything to Givebutter
   or to a database. The widget id is a made-up value of the right shape —
   Givebutter's API cannot tell which campaign a widget belongs to, so it
   is never part of verification. Nothing is printed but outcomes; the key
   is checked to appear in no result. */

const key = process.env.GIVEBUTTER_API_KEY;
const campaignId = process.env.LIVE_GIVEBUTTER_CAMPAIGN_ID;
const skip = !key ? "GIVEBUTTER_API_KEY not set" : !campaignId ? "LIVE_GIVEBUTTER_CAMPAIGN_ID not set" : false;

const verifierWith = (apiKey: string) => checkoutVerifier(() => new GivebutterProvider(new GivebutterClient({ apiKey })));
const checkout = (o: Record<string, unknown> = {}) => ({ provider: "givebutter" as const, campaignId: campaignId!, widgetId: "LiveW1", widgetType: "form" as const, ...o });
const at = "body.donation.checkout";

test("live: the configured campaign verifies, with and without its own defaults", { skip }, async () => {
  const verify = verifierWith(key!);
  const campaign = await new GivebutterProvider(new GivebutterClient({ apiKey: key! })).getCampaign(campaignId!);
  assert.ok(campaign, "the campaign exists");
  assert.deepEqual(await verify([{ path: at, checkout: checkout() }]), []);
  const frequency = campaign!.checkout.frequencies[0]!;
  const amount = campaign!.checkout.amounts[frequency]?.[0];
  if (amount !== undefined) assert.deepEqual(await verify([{ path: at, checkout: checkout({ defaultFrequency: frequency, defaultAmount: amount }) }]), []);
  const problems = await verify([{ path: at, checkout: checkout({ defaultFrequency: frequency, defaultAmount: 0.01 }) }]);
  assert.deepEqual(problems.map((p) => p.path), [`${at}.defaultAmount`], "an amount the campaign does not offer is refused");
  assert.ok(!JSON.stringify(problems).includes(key!));
});

test("live: a missing campaign and a refused key fail safely", { skip }, async () => {
  const missing = await verifierWith(key!)([{ path: at, checkout: checkout({ campaignId: "1" }) }]);
  assert.deepEqual(missing, [{ path: `${at}.campaignId`, message: "is not a campaign in the connected Givebutter account" }]);
  const refused = await verifierWith("invalid-key-for-live-test-000000000000")([{ path: at, checkout: checkout() }]);
  assert.deepEqual(refused, [{ path: `${at}.campaignId`, message: "cannot be verified: the donation provider refused the server's credentials" }]);
  assert.ok(!JSON.stringify([missing, refused]).includes(key!));
});
