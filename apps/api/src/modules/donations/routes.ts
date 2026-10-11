import { z } from "zod";
import { ApiError, errors, fromZod } from "../../errors.ts";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import { ProviderError, type DonationProvider } from "./provider.ts";

/* Read-only, authenticated access to the donation provider's campaigns —
   what a future admin screen will use to attach a campaign to an RBB
   donation page. Members with `appeals:read` only; the provider's API is
   never reachable anonymously.

   Provider failures become the API's own errors with generic messages:
   the provider's response, status text and the reason a key was refused
   go to the log, never to the client. */

export function providerFailure(error: unknown): ApiError | null {
  if (!(error instanceof ProviderError)) return null;
  switch (error.failure) {
    case "not-configured":
      return errors.unavailable("The donation provider is not configured.", error);
    case "unauthorized":
      return errors.unavailable("The donation provider is not configured correctly.", error);
    case "not-found":
      return errors.notFound("campaign");
    case "rate-limited":
      return new ApiError("SERVICE_UNAVAILABLE", "The donation provider is busy. Try again shortly.", {
        cause: error,
        ...(error.retryAfterSeconds && { headers: { "Retry-After": String(error.retryAfterSeconds) } }),
      });
    default:
      return errors.unavailable("The donation provider is unavailable.", error);
  }
}

const CampaignParams = z.object({ campaignId: z.string().regex(/^\d{1,20}$/, "must be a provider campaign id") });

export const donationRoutes = (provider: () => DonationProvider): Route[] => [
  {
    method: "GET",
    path: "/api/v1/integrations/donations/campaigns",
    auth: "required",
    permission: "appeals:read",
    async handler() {
      try {
        const source = provider();
        return ok({ provider: source.id, campaigns: await source.listCampaigns() });
      } catch (error) {
        throw providerFailure(error) ?? error;
      }
    },
  },
  {
    method: "GET",
    path: "/api/v1/integrations/donations/campaigns/:campaignId",
    auth: "required",
    permission: "appeals:read",
    async handler({ params }) {
      const parsed = CampaignParams.safeParse(params);
      if (!parsed.success) throw fromZod(parsed.error, "params");
      try {
        const campaign = await provider().getCampaign(parsed.data.campaignId);
        if (!campaign) throw errors.notFound("campaign");
        return ok(campaign);
      } catch (error) {
        throw providerFailure(error) ?? error;
      }
    },
  },
];
