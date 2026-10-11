/* Givebutter, isolated: nothing outside src/integrations/ imports from
   here — pages ask for a checkout through donations/DonationCheckout. */
export { default as GivebutterForm, GIVEBUTTER_FREQUENCIES, isGivebutterWidgetId } from "./GivebutterForm.jsx";
export { isGivebutterAccountId, loadGivebutter } from "./loader.js";
