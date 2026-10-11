import type { DonationCheckout } from "@rbb/content-schema";
import type { ErrorDetail } from "../../errors.ts";
import { ProviderError, type DonationProvider, type ProviderCampaign, type ProviderFailure } from "./provider.ts";

/* Verifying a page's provider checkout against the provider itself —
   server-side, through the DonationProvider boundary (never a second
   Givebutter client, never from the browser). What can be proven:

     · the campaign exists in the account the server's key belongs to
     · it is active
     · a default frequency is one the campaign offers
     · a default amount is one of the campaign's own amounts for that
       frequency, and not below its minimum

   What cannot: that the widget id belongs to that campaign. Givebutter's
   API does not list widgets (docs/GIVEBUTTER_SPIKE.md), so the widget id
   is checked for shape by the contract and stored as the editor set it —
   never inferred, never "matched".

   Anything the provider cannot confirm right now (not configured,
   credentials refused, unreachable) is a problem too: a page is only
   published with a checkout that was verified. Messages are the API's
   own; the provider's responses never reach a client. */

export interface CheckoutReference {
  /* Where the checkout sits, for the error path ("body.donation.checkout"). */
  path: string;
  checkout: DonationCheckout;
}

export type CheckoutVerifier = (references: CheckoutReference[]) => Promise<ErrorDetail[]>;

const UNVERIFIABLE: Record<ProviderFailure, string> = {
  "not-configured": "cannot be verified: the donation provider is not configured on the server",
  unauthorized: "cannot be verified: the donation provider refused the server's credentials",
  "not-found": "is not a campaign in the connected Givebutter account",
  "rate-limited": "cannot be verified right now: the donation provider is busy — try again shortly",
  unavailable: "cannot be verified right now: the donation provider is unavailable",
  "bad-response": "cannot be verified right now: the donation provider returned something unexpected",
};

export function checkoutVerifier(provider: () => DonationProvider): CheckoutVerifier {
  return async (references) => {
    if (!references.length) return [];
    let source: DonationProvider;
    try {
      source = provider();
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      return references.map(({ path }) => ({ path: `${path}.campaignId`, message: UNVERIFIABLE[error.failure] }));
    }

    // One provider call per campaign, however many pages use it.
    const campaigns = new Map<string, ProviderCampaign | null | ProviderFailure>();
    for (const id of new Set(references.map((r) => r.checkout.campaignId))) {
      try {
        campaigns.set(id, await source.getCampaign(id));
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        campaigns.set(id, error.failure);
      }
    }

    return references.flatMap(({ path, checkout }) => {
      const found = campaigns.get(checkout.campaignId);
      if (typeof found === "string") return [{ path: `${path}.campaignId`, message: UNVERIFIABLE[found] }];
      if (!found) return [{ path: `${path}.campaignId`, message: UNVERIFIABLE["not-found"] }];
      return campaignProblems(found, checkout, path);
    });
  };
}

/* The checkout against a campaign the provider returned. Pure. */
export function campaignProblems(campaign: ProviderCampaign, checkout: DonationCheckout, path: string): ErrorDetail[] {
  const problems: ErrorDetail[] = [];
  if (campaign.provider !== checkout.provider) problems.push({ path: `${path}.provider`, message: "does not match the connected donation provider" });
  if (campaign.status !== "active") problems.push({ path: `${path}.campaignId`, message: `is not an active campaign (Givebutter reports it as "${campaign.status}")` });

  const { frequencies, defaultFrequency, amounts, minimumAmount } = campaign.checkout;
  if (checkout.defaultFrequency && !frequencies.includes(checkout.defaultFrequency))
    problems.push({ path: `${path}.defaultFrequency`, message: "is not a frequency this campaign offers" });

  if (checkout.defaultAmount !== undefined) {
    const frequency = checkout.defaultFrequency ?? defaultFrequency;
    const offered = frequency ? (amounts[frequency] ?? []) : Object.values(amounts).flat();
    if (minimumAmount !== null && checkout.defaultAmount < minimumAmount)
      problems.push({ path: `${path}.defaultAmount`, message: `is below this campaign's minimum (${minimumAmount})` });
    else if (!offered.includes(checkout.defaultAmount))
      problems.push({
        path: `${path}.defaultAmount`,
        message: offered.length ? `is not one of the amounts this campaign offers${frequency ? ` ${frequency}` : ""} (${offered.join(", ")})` : "cannot be preselected: this campaign lists no amounts",
      });
  }
  return problems;
}
