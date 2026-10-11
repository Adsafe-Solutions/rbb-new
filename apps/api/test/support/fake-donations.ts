import { ProviderError, type DonationProvider, type ProviderCampaign, type ProviderFailure } from "../../src/modules/donations/provider.ts";

/* A deterministic DonationProvider for tests — no network, no key, no
   real account data. Campaigns are made up (ids 9xxxxx); `fail` makes
   every call fail the way a real provider would. */
export const fakeCampaign = (overrides: Partial<ProviderCampaign> = {}): ProviderCampaign => ({
  provider: "givebutter",
  campaignId: "900001",
  campaignCode: "TESTC1",
  accountId: "TestAccount0001",
  title: "Test Campaign",
  type: "collect",
  status: "active",
  url: null,
  currency: "USD",
  goal: null,
  raised: 0,
  donors: 0,
  endAt: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  checkout: { frequencies: ["once", "monthly"], defaultFrequency: "once", amounts: { once: [100, 50, 25], monthly: [25, 10] }, minimumAmount: 5 },
  ...overrides,
});

export class FakeDonationProvider implements DonationProvider {
  readonly id = "givebutter" as const;
  readonly campaigns = new Map<string, ProviderCampaign>();
  fail: ProviderFailure | null = null;
  calls: string[] = [];
  constructor(...campaigns: ProviderCampaign[]) {
    for (const c of campaigns.length ? campaigns : [fakeCampaign()]) this.campaigns.set(c.campaignId, c);
  }
  async listCampaigns() {
    if (this.fail) throw new ProviderError(this.fail);
    return [...this.campaigns.values()];
  }
  async getCampaign(id: string) {
    this.calls.push(id);
    if (this.fail) throw new ProviderError(this.fail);
    return this.campaigns.get(id) ?? null;
  }
}

/* A checkout for the default fake campaign. */
export const testCheckout = (overrides: Record<string, unknown> = {}) => ({ provider: "givebutter", campaignId: "900001", widgetId: "TestW1", widgetType: "form", ...overrides });
