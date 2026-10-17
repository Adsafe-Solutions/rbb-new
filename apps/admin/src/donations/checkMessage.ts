/* What the admin says when a Givebutter campaign check fails. The API
   (apps/api modules/donations/routes.ts providerFailure) answers 503 for
   four different reasons, each with its own message — never the
   provider's own wording or the key — so the admin names the one that
   happened and what fixes it, instead of one line for all four. */

const PROVIDER_503: [RegExp, string][] = [
  [/not configured correctly/i, "Givebutter refused the server's API key. Check GIVEBUTTER_API_KEY in the API's environment (production), then redeploy the API."],
  [/not configured/i, "The server has no Givebutter API key. Add GIVEBUTTER_API_KEY to the API's environment (production), then redeploy the API."],
  [/busy/i, "Givebutter is busy right now. Try again in a minute."],
  [/unavailable/i, "Givebutter did not answer the server in time. Try again later."],
];

export function campaignCheckMessage(status: number, message: string): string {
  if (status === 404) return "Givebutter has no campaign with this ID in the connected account.";
  if (status === 400) return "A campaign ID is digits only.";
  if (status === 503) return PROVIDER_503.find(([pattern]) => pattern.test(message))?.[1] ?? "Givebutter could not be reached, or the server's connection to it is not set up. Try again later.";
  if (status === 0) return "The server could not be reached. Try again.";
  return "The campaign could not be checked. Try again.";
}
