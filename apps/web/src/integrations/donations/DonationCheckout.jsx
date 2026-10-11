import GivebutterForm, { isGivebutterWidgetId } from "../givebutter/GivebutterForm.jsx";
import { GIVEBUTTER_ACCOUNT_ID } from "../../config/env.js";

/* The donation checkout SLOT — the one place a page asks for "the checkout
   for this campaign" without knowing which provider runs it. It is not a
   content block: a page supplies a checkout CONFIGURATION (safe
   identifiers, never HTML), and this decides what to render.

     checkout: {
       provider:   "givebutter"
       widgetType: "form"
       widgetId:   the provider's widget id
       amount?, frequency?   optional preselection (validated downstream)
     }

   An unknown provider, widget type or missing account renders nothing —
   never a broken or half-configured checkout. Adding a provider means a
   new branch here and a component beside GivebutterForm. */
/* Whether this build can draw the checkout at all — a page that cannot
   keeps the site's own donation form instead (components/DonationExperience). */
export const checkoutAvailable = (checkout) =>
  Boolean(checkout && checkout.provider === "givebutter" && checkout.widgetType === "form" && GIVEBUTTER_ACCOUNT_ID && isGivebutterWidgetId(checkout.widgetId));

export default function DonationCheckout({ checkout, onStatus }) {
  if (!checkout) return null;
  if (checkoutAvailable(checkout))
    return (
      <GivebutterForm
        widgetId={checkout.widgetId}
        accountId={GIVEBUTTER_ACCOUNT_ID}
        amount={checkout.amount}
        frequency={checkout.frequency}
        onStatus={onStatus}
      />
    );
  return null;
}
