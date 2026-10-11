import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, loadConfig } from "../src/config/env.ts";
import { createApp } from "../src/app.ts";
import { GIVEBUTTER_API, GivebutterClient } from "../src/modules/donations/givebutter/client.ts";
import { GivebutterProvider, toProviderCampaign } from "../src/modules/donations/givebutter/provider.ts";
import { ProviderError } from "../src/modules/donations/provider.ts";
import { providerFailure } from "../src/modules/donations/routes.ts";
import { captureLogs, get, jsonOf, testConfig } from "./helpers.ts";

/* Givebutter is MOCKED here: no real key, no real account data. The
   fixture follows the shape the live API returned during the spike. */

const FAKE_KEY = "test-givebutter-key-not-real-0000000000";

const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: 111111,
  code: "TESTC1",
  account_id: "TestAccount0001",
  event_id: null,
  type: "collect",
  title: "Test Campaign",
  subtitle: null,
  description: "<p>Not used by the platform</p>",
  slug: "test-campaign",
  url: "https://givebutter.com/TESTC1",
  goal: 20000,
  raised: 125.5,
  donors: 3,
  currency: "USD",
  cover: { url: "https://example.org/cover.jpg", type: "image", source: "upload" },
  status: "active",
  timezone: "UTC",
  end_at: null,
  settings: [
    { name: "display_frequencies", value: ["once", "monthly"] },
    { name: "default_frequency", value: "once" },
    { name: "custom_donation_amounts", value: { once: [{ value: 100 }, { value: 50 }], monthly: [{ value: 25 }] } },
    { name: "minimum_donation", value: "1.00" },
    { name: "hide_money_raised", value: false },
  ],
  created_at: "2026-10-01T00:00:00.000000Z",
  updated_at: "2026-10-06T00:00:00.000000Z",
  ...overrides,
});

const page = (data: unknown[], current = 1, last = 1) => ({ data, links: {}, meta: { current_page: current, last_page: last, per_page: 20, total: data.length } });

/* A fetch stand-in that records requests and answers from a script. */
function fakeFetch(answer: (url: string) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return answer(String(input));
  }) as typeof fetch;
  return { calls, impl };
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const providerWith = (answer: (url: string) => Response | Promise<Response>, timeoutMs?: number) => {
  const fake = fakeFetch(answer);
  return { ...fake, provider: new GivebutterProvider(new GivebutterClient({ apiKey: FAKE_KEY, fetch: fake.impl, ...(timeoutMs && { timeoutMs }) })) };
};
const failureOf = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ProviderError).failure;

/* ---------------- Configuration ---------------- */

test("config: the Givebutter key is optional, server-side, and validated without echoing it", () => {
  assert.equal(loadConfig({}).integrations.givebutter, null);
  assert.deepEqual(loadConfig({ GIVEBUTTER_API_KEY: FAKE_KEY }).integrations.givebutter, { apiKey: FAKE_KEY });
  for (const bad of ["short", "has spaces in it which is wrong", `"${FAKE_KEY}"`]) {
    const error = (() => {
      try {
        loadConfig({ GIVEBUTTER_API_KEY: bad });
      } catch (e) {
        return e as ConfigError;
      }
    })();
    assert.ok(error instanceof ConfigError, bad);
    assert.ok(!error.problems.join(" ").includes(bad));
  }
});

test("client: refuses to exist without a key", () => {
  assert.throws(() => new GivebutterClient({ apiKey: "" }), (e: ProviderError) => e.failure === "not-configured");
});

/* ---------------- Requests ---------------- */

test("client: GET to the documented base URL with a Bearer key", async () => {
  const { calls, provider } = providerWith(() => json(200, page([campaign()])));
  await provider.listCampaigns();
  assert.equal(calls[0]!.url, `${GIVEBUTTER_API}/campaigns?page=1`);
  assert.equal(calls[0]!.init.method, "GET");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${FAKE_KEY}`);
  assert.equal(headers.Accept, "application/json");
  assert.ok(calls[0]!.init.signal, "every request has a timeout signal");
});

test("listing: every page is read, up to the last", async () => {
  const { calls, provider } = providerWith((url) =>
    url.endsWith("page=1") ? json(200, page([campaign()], 1, 2)) : json(200, page([campaign({ id: 222222, code: "TESTC2" })], 2, 2))
  );
  const campaigns = await provider.listCampaigns();
  assert.deepEqual(campaigns.map((c) => c.campaignCode), ["TESTC1", "TESTC2"]);
  assert.equal(calls.length, 2);
});

/* ---------------- Mapping ---------------- */

test("mapping: provider-neutral, ids kept apart, checkout options read from settings", () => {
  const mapped = toProviderCampaign(campaign() as never);
  assert.deepEqual(mapped, {
    provider: "givebutter",
    campaignId: "111111",
    campaignCode: "TESTC1",
    accountId: "TestAccount0001",
    title: "Test Campaign",
    type: "collect",
    status: "active",
    url: "https://givebutter.com/TESTC1",
    currency: "USD",
    goal: 20000,
    raised: 125.5,
    donors: 3,
    endAt: null,
    updatedAt: "2026-10-06T00:00:00.000000Z",
    checkout: { frequencies: ["once", "monthly"], defaultFrequency: "once", amounts: { once: [100, 50], monthly: [25] }, minimumAmount: 1 },
  });
  assert.equal("description" in mapped, false, "provider HTML never passes through");
  assert.notEqual(mapped.campaignId, mapped.campaignCode, "the numeric id and the public code are different identifiers");
});

test("mapping: settings shapes that vary between campaigns are tolerated", () => {
  const mapped = toProviderCampaign(
    campaign({ settings: [{ name: "minimum_donation", value: { amount: 5 } }, { name: "display_frequencies", value: "once" }], goal: null }) as never
  );
  assert.deepEqual(mapped.checkout, { frequencies: [], defaultFrequency: null, amounts: {}, minimumAmount: null });
  assert.equal(mapped.goal, null);
  assert.deepEqual(toProviderCampaign(campaign({ settings: undefined }) as never).checkout.frequencies, []);
});

test("single campaign: unwrapped (as the live API returns it) or wrapped; 404 is null", async () => {
  const unwrapped = await providerWith(() => json(200, campaign())).provider.getCampaign("111111");
  assert.equal(unwrapped?.campaignCode, "TESTC1");
  const wrapped = await providerWith(() => json(200, { data: campaign() })).provider.getCampaign("111111");
  assert.equal(wrapped?.campaignCode, "TESTC1");
  assert.equal(await providerWith(() => json(404, { message: "Not found" })).provider.getCampaign("999"), null);
  const { calls, provider } = providerWith(() => json(200, campaign()));
  assert.equal(await provider.getCampaign("TESTC1"), null, "a code or widget id is not a campaign id");
  assert.equal(calls.length, 0, "and no request is made for it");
});

/* ---------------- Failures ---------------- */

test("malformed responses are bad-response, never a half-mapped campaign", async () => {
  assert.equal(await failureOf(providerWith(() => new Response("<html>oops</html>", { status: 200 })).provider.listCampaigns()), "bad-response");
  assert.equal(await failureOf(providerWith(() => json(200, { data: [{ id: 1 }], meta: { current_page: 1, last_page: 1 } })).provider.listCampaigns()), "bad-response");
  assert.equal(await failureOf(providerWith(() => json(200, { unexpected: true })).provider.listCampaigns()), "bad-response");
});

test("non-2xx responses map to categories", async () => {
  const cases: [number, string][] = [[401, "unauthorized"], [403, "unauthorized"], [404, "not-found"], [429, "rate-limited"], [500, "unavailable"], [503, "unavailable"]];
  for (const [status, failure] of cases) assert.equal(await failureOf(providerWith(() => json(status, { error: "x" })).provider.listCampaigns()), failure, String(status));
  const limited = (await providerWith(() => json(429, {}, { "Retry-After": "30" })).provider.listCampaigns().catch((e) => e)) as ProviderError;
  assert.equal(limited.retryAfterSeconds, 30);
});

test("a hanging request times out as unavailable", async () => {
  const hanging = (_: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError"))));
  const fake = { calls: [] as unknown[], impl: ((u: string, i: RequestInit) => hanging(u, i)) as unknown as typeof fetch };
  const provider = new GivebutterProvider(new GivebutterClient({ apiKey: FAKE_KEY, fetch: fake.impl, timeoutMs: 50 }));
  const started = Date.now();
  assert.equal(await failureOf(provider.listCampaigns()), "unavailable");
  assert.ok(Date.now() - started < 2000);
});

test("provider failures become generic API errors that never carry the key or the provider's body", () => {
  const cases: [ProviderError, string, number][] = [
    [new ProviderError("not-configured"), "SERVICE_UNAVAILABLE", 503],
    [new ProviderError("unauthorized", { status: 401 }), "SERVICE_UNAVAILABLE", 503],
    [new ProviderError("rate-limited", { status: 429, retryAfterSeconds: 12 }), "SERVICE_UNAVAILABLE", 503],
    [new ProviderError("unavailable", { status: 502 }), "SERVICE_UNAVAILABLE", 503],
    [new ProviderError("not-found", { status: 404 }), "NOT_FOUND", 404],
  ];
  for (const [error, code, status] of cases) {
    const mapped = providerFailure(error)!;
    assert.equal(mapped.code, code);
    assert.equal(mapped.status, status);
    assert.ok(!mapped.message.includes(FAKE_KEY));
    assert.ok(!/givebutter/i.test(mapped.message), "clients are not told which provider failed");
  }
  assert.equal(providerFailure(cases[2]![0])!.headers?.["Retry-After"], "12");
  assert.equal(providerFailure(new Error("other")), null);
});

/* ---------------- HTTP (no database needed to refuse) ---------------- */

test("the campaign routes require a session, and the key never appears in responses or logs", async () => {
  const logs = captureLogs();
  const app = createApp({ config: testConfig({ integrations: { givebutter: { apiKey: FAKE_KEY } } }), mongo: null, write: logs.write });
  for (const path of ["/api/v1/integrations/donations/campaigns", "/api/v1/integrations/donations/campaigns/111111"]) {
    const res = await get(app, path);
    assert.equal(res.status, 401, path);
    assert.equal((await jsonOf(res)).error.code, "UNAUTHENTICATED");
  }
  assert.ok(!logs.text().includes(FAKE_KEY));
  assert.equal((await get(app, "/api/v1/integrations/givebutter/campaigns")).status, 404, "no provider-specific public route");
});
