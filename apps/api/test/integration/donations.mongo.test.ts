import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { ProviderError, type DonationProvider, type ProviderCampaign } from "../../src/modules/donations/provider.ts";
import { CHEAP_SCRYPT, addMember } from "../auth/memory.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* The campaign routes behind real sessions (disposable MongoDB), with a
   stand-in provider — no call to Givebutter here. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const logs = captureLogs();

const sample: ProviderCampaign = {
  provider: "givebutter",
  campaignId: "111111",
  campaignCode: "TESTC1",
  accountId: "TestAccount0001",
  title: "Test Campaign",
  type: "collect",
  status: "active",
  url: "https://givebutter.com/TESTC1",
  currency: "USD",
  goal: 1000,
  raised: 0,
  donors: 0,
  endAt: null,
  updatedAt: "2026-10-06T00:00:00.000000Z",
  checkout: { frequencies: ["once"], defaultFrequency: "once", amounts: { once: [25] }, minimumAmount: 1 },
};

const fakeProvider = (behaviour: "ok" | "unauthorized" | "down"): DonationProvider => ({
  id: "givebutter",
  listCampaigns: async () => {
    if (behaviour === "unauthorized") throw new ProviderError("unauthorized", { status: 401 });
    if (behaviour === "down") throw new ProviderError("unavailable", { status: 503 });
    return [sample];
  },
  getCampaign: async (id) => (id === sample.campaignId ? sample : null),
});

const appWith = (donationProvider: DonationProvider | null): App =>
  createApp({
    config: testConfig({ orgId: "org-d", mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }),
    mongo: provider,
    scrypt: CHEAP_SCRYPT,
    write: logs.write,
    donationProvider,
  });

const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.20" });
async function sessionFor(app: App, email: string) {
  const res = await call(app, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
}
const as = (token: string) => ({ headers: { Origin: ADMIN, Cookie: `cms_session=${token}` } });

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  const stores = mongoAuthStores(mongo.db(), "org-d");
  await addMember(stores, { orgId: "org-d", email: "owner@d.example", password: PASSWORD, role: "OWNER" });
  await addMember(stores, { orgId: "org-d", email: "editor@d.example", password: PASSWORD, role: "EDITOR" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("members with appeals:read see provider-neutral campaigns; nothing secret", async () => {
  const app = appWith(fakeProvider("ok"));
  for (const email of ["owner@d.example", "editor@d.example"]) {
    const res = await call(app, "/api/v1/integrations/donations/campaigns", as(await sessionFor(app, email)));
    assert.equal(res.status, 200, email);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text).data, { provider: "givebutter", campaigns: [sample] });
    assert.ok(!text.includes(FAKE_KEY));
  }
  const token = await sessionFor(app, "owner@d.example");
  assert.equal((await call(app, "/api/v1/integrations/donations/campaigns/111111", as(token))).status, 200);
  assert.equal((await call(app, "/api/v1/integrations/donations/campaigns/999999", as(token))).status, 404);
  assert.equal((await call(app, "/api/v1/integrations/donations/campaigns/jNKkQk", as(token))).status, 400, "a widget id is not a campaign id");
});

test("provider failures and a missing provider are generic 503s", async () => {
  for (const [donationProvider, message] of [
    [fakeProvider("unauthorized"), "The donation provider is not configured correctly."],
    [fakeProvider("down"), "The donation provider is unavailable."],
    [null, "The donation provider is not configured."],
  ] as const) {
    const app = appWith(donationProvider);
    const res = await call(app, "/api/v1/integrations/donations/campaigns", as(await sessionFor(app, "owner@d.example")));
    assert.equal(res.status, 503);
    const body = await jsonOf(res);
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
    assert.equal(body.error.message, message);
  }
  assert.ok(!logs.text().includes(FAKE_KEY), "the key never reaches the log");
});
