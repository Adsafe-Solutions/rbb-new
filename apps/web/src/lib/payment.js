/* The payment boundary — the ONE place the donation form hands a donation
   over to be paid. Frontend only: nothing here makes a request, loads a
   script or holds a credential.

   No payment provider is connected yet (Razorpay was removed; RBB's new
   provider is still to be chosen), so `startPayment` answers
   "unavailable" and the form shows its provider-error state — never a
   success, never a reference. Connecting a provider means replacing the
   body of `startPayment` (and setting PAYMENT_CONNECTED), not touching
   the form: every donation page, the Donate popup and any future page
   share components/DonationForm, which only calls this.

   The donation it receives:
     {
       amount:     { minor, currency }   — minor units; currency may be null
       frequency:  "one-time" | "monthly"
       donor:      { name, email, phone? }
       context:    { type, appeal?, campaign?, project?, designation?, source? }
                   — where the gift was made from; never shown to the donor
     }
   It resolves to { outcome: "unavailable" | "redirect" | "error", ... }. */

/* False until a real provider is wired in. While false, the form keeps
   `data-donation-preview` on its card, which the release check reads to
   block a production release (scripts/lib/release-checks.mjs). */
export const PAYMENT_CONNECTED = false;

// eslint-disable-next-line no-unused-vars
export async function startPayment(donation) {
  return { outcome: "unavailable" };
}

export default startPayment;
