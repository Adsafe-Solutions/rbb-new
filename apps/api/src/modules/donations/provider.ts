/* The donation-provider boundary. The rest of the platform talks to a
   DonationProvider and sees ProviderCampaigns — never Givebutter's own
   shapes — so another provider can stand in later without touching the
   donation experience.

   What a provider is responsible for here: reading campaigns and their
   public checkout options. Checkout itself (payment details, card data,
   recurring billing) never passes through the API: the provider's own
   widget handles it in the browser. */

export interface ProviderCampaign {
  provider: "givebutter";
  /* The provider's stable identifier for the campaign (Givebutter: the
     numeric id, as a string). */
  campaignId: string;
  /* The public code that appears in the campaign's URL and in the
     provider's campaign-based widget elements. NOT a widget id: a widget
     has its own identifier, which the API does not expose. */
  campaignCode: string;
  /* The public account identifier the provider's widget library needs. */
  accountId: string;
  title: string;
  type: string;
  status: string;
  url: string | null;
  currency: string;
  goal: number | null;
  raised: number;
  donors: number;
  endAt: string | null;
  updatedAt: string;
  /* What the provider's checkout offers — what an RBB page may preselect.
     Givebutter ignores a preselected amount or frequency the campaign does
     not offer, so these are what a future CMS would validate against. */
  checkout: {
    frequencies: string[];
    defaultFrequency: string | null;
    amounts: Record<string, number[]>;
    minimumAmount: number | null;
  };
}

export interface DonationProvider {
  readonly id: ProviderCampaign["provider"];
  listCampaigns(): Promise<ProviderCampaign[]>;
  /* null when the provider has no such campaign. */
  getCampaign(campaignId: string): Promise<ProviderCampaign | null>;
}

/* Why a provider call failed — without the provider's raw response. */
export type ProviderFailure = "not-configured" | "unauthorized" | "not-found" | "rate-limited" | "unavailable" | "bad-response";

export class ProviderError extends Error {
  readonly failure: ProviderFailure;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(failure: ProviderFailure, { status = null, retryAfterSeconds = null }: { status?: number | null; retryAfterSeconds?: number | null } = {}) {
    super(`Donation provider call failed: ${failure}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "ProviderError";
    this.failure = failure;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
