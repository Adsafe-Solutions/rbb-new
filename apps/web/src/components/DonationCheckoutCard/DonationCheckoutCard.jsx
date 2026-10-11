import { useState } from "react";
import DonationCheckout from "../../integrations/donations/DonationCheckout.jsx";

/* The donation page's form slot when the CMS gave the page a provider
   checkout (Givebutter's own Form widget): the same white card and
   focusable heading as the site's DonationForm — "Donate" elsewhere on the
   page still brings the reader here — with the provider's widget inside.

   Everything in the widget is the provider's: amounts, payment, recurring
   gifts, receipts. This card never says a gift succeeded. If the provider
   cannot be loaded (blocked, offline), it says giving is unavailable and
   that nothing was taken — the same words as the site's own form — and
   never shows a provider error. */
const CARD = "rounded-2xl border-rim bg-paper-white p-5 text-bumble-ink cast-lg sm:p-8";

export default function DonationCheckoutCard({ checkout, copy, formId }) {
  const [status, setStatus] = useState("loading");
  return (
    <div data-tone="card" className={CARD} data-donation-checkout={checkout.provider}>
      <div className="border-b-2 border-dashed border-hair pb-5">
        <h2 id={`${formId}-heading`} tabIndex={-1} className="text-[24px] font-black leading-tight tracking-tight text-trust-blue outline-none">
          {copy.heading}
        </h2>
      </div>
      <div className="mt-6 min-w-0">
        {status === "failed" ? (
          <div role="alert" className="rounded-2xl border-2 border-bumble-honey p-5 sm:p-6">
            <h3 className="type-card text-trust-blue">{copy.unavailable.heading}</h3>
            <p className="mt-2">{copy.unavailable.body}</p>
          </div>
        ) : (
          <DonationCheckout checkout={checkout} onStatus={setStatus} />
        )}
      </div>
    </div>
  );
}
