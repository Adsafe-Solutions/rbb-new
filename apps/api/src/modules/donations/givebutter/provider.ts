import { z } from "zod";
import { ProviderError, type DonationProvider, type ProviderCampaign } from "../provider.ts";
import type { GivebutterClient } from "./client.ts";

/* Givebutter → the platform's ProviderCampaign. The schemas below describe
   only the fields the platform uses, as the live API returns them
   (verified against the real account): unknown fields are ignored, so a
   field Givebutter adds later does not break anything, and a missing
   required field is a `bad-response`, never a half-mapped campaign.

   Shapes observed in practice that the documentation does not spell out:
     · GET /campaigns          { data: Campaign[], links, meta }
     · GET /campaigns/{id}     the Campaign itself (no `data` wrapper)
     · settings                [{ name, value }] where value is a boolean,
                               string, array or object depending on the
                               setting — and can differ between campaigns
                               (minimum_donation: "1.00" or an object) */

const Setting = z.object({ name: z.string(), value: z.unknown() });

const Campaign = z.object({
  id: z.union([z.number(), z.string()]),
  code: z.string().min(1),
  account_id: z.string().min(1),
  type: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  goal: z.number().nullable().optional(),
  raised: z.number().optional(),
  donors: z.number().optional(),
  currency: z.string(),
  status: z.string(),
  end_at: z.string().nullable().optional(),
  updated_at: z.string(),
  settings: z.array(Setting).optional(),
});
type Campaign = z.infer<typeof Campaign>;

const Page = z.object({
  data: z.array(Campaign),
  meta: z.object({ current_page: z.number(), last_page: z.number() }),
});

/* Read the checkout options out of `settings`, tolerating the shapes seen. */
const settingOf = (campaign: Campaign, name: string) => campaign.settings?.find((s) => s.name === name)?.value;

function checkoutOf(campaign: Campaign): ProviderCampaign["checkout"] {
  const frequencies = settingOf(campaign, "display_frequencies");
  const defaultFrequency = settingOf(campaign, "default_frequency");
  const customAmounts = settingOf(campaign, "custom_donation_amounts");
  const minimum = settingOf(campaign, "minimum_donation");

  const amounts: Record<string, number[]> = {};
  if (customAmounts && typeof customAmounts === "object" && !Array.isArray(customAmounts)) {
    for (const [frequency, options] of Object.entries(customAmounts as Record<string, unknown>)) {
      if (!Array.isArray(options)) continue;
      amounts[frequency] = options
        .map((o) => (o && typeof o === "object" ? Number((o as { value?: unknown }).value) : Number(o)))
        .filter((n) => Number.isFinite(n) && n > 0);
    }
  }
  const minimumAmount = typeof minimum === "string" || typeof minimum === "number" ? Number(minimum) : NaN;

  return {
    frequencies: Array.isArray(frequencies) ? frequencies.filter((f): f is string => typeof f === "string") : [],
    defaultFrequency: typeof defaultFrequency === "string" ? defaultFrequency : null,
    amounts,
    minimumAmount: Number.isFinite(minimumAmount) && minimumAmount > 0 ? minimumAmount : null,
  };
}

export const toProviderCampaign = (campaign: Campaign): ProviderCampaign => ({
  provider: "givebutter",
  campaignId: String(campaign.id),
  campaignCode: campaign.code,
  accountId: campaign.account_id,
  title: campaign.title,
  type: campaign.type,
  status: campaign.status,
  url: campaign.url ?? null,
  currency: campaign.currency,
  goal: campaign.goal ?? null,
  raised: campaign.raised ?? 0,
  donors: campaign.donors ?? 0,
  endAt: campaign.end_at ?? null,
  updatedAt: campaign.updated_at,
  checkout: checkoutOf(campaign),
});

/* At most this many pages (20 campaigns each) are read in one listing. */
const MAX_PAGES = 10;

export class GivebutterProvider implements DonationProvider {
  readonly id = "givebutter" as const;
  readonly #client: GivebutterClient;

  constructor(client: GivebutterClient) {
    this.#client = client;
  }

  async listCampaigns(): Promise<ProviderCampaign[]> {
    const campaigns: ProviderCampaign[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const parsed = Page.safeParse(await this.#client.get(`/campaigns?page=${page}`));
      if (!parsed.success) throw new ProviderError("bad-response");
      campaigns.push(...parsed.data.data.map(toProviderCampaign));
      if (parsed.data.meta.current_page >= parsed.data.meta.last_page) break;
    }
    return campaigns;
  }

  async getCampaign(campaignId: string): Promise<ProviderCampaign | null> {
    if (!/^\d{1,20}$/.test(campaignId)) return null;
    let body: unknown;
    try {
      body = await this.#client.get(`/campaigns/${campaignId}`);
    } catch (error) {
      if (error instanceof ProviderError && error.failure === "not-found") return null;
      throw error;
    }
    /* Unwrapped today; accept a `data` wrapper in case that changes. */
    const candidate = body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : body;
    const parsed = Campaign.safeParse(candidate);
    if (!parsed.success) throw new ProviderError("bad-response");
    return toProviderCampaign(parsed.data);
  }
}
