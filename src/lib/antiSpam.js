/* The anti-spam integration point — Document 12 §9. NO provider is
   selected: `ADAPTERS` is empty on purpose, and choosing a vendor is RBB's
   decision.

   When one is chosen, register an adapter here under the name the form's
   `antiSpam.provider` uses:

     ADAPTERS.vendorName = {
       // Returns a one-time token for the server to verify, or throws.
       token: async ({ siteKey, formId }) => "…",
     };

   Only a PUBLIC site key ever reaches the browser. The secret that
   verifies the token lives on the server, which must also rate-limit and
   re-validate every submission — nothing here is a defence on its own,
   and neither is a hidden "honeypot" field. */
const ADAPTERS = {};

/* True when a form either asks for no anti-spam, or asks for one that is
   actually registered. A form naming an unregistered provider is not
   ready — it would submit without the check it claims to have. */
export const antiSpamReady = (antiSpam) => !antiSpam?.provider || Boolean(ADAPTERS[antiSpam.provider]);

/* The token to send with a submission, or null when none is configured. */
export async function antiSpamToken(antiSpam, formId) {
  if (!antiSpam?.provider) return null;
  const adapter = ADAPTERS[antiSpam.provider];
  if (!adapter) throw new Error("anti-spam provider not registered");
  return adapter.token({ siteKey: antiSpam.siteKey, formId });
}
