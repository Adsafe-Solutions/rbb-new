import { useEffect, useState } from "react";
import { loadGivebutter } from "./loader.js";

/* One Givebutter Form Widget — Givebutter's own checkout, embedded. The
   page around it is RBB's; everything inside it (amounts, payment
   methods, card entry, recurring billing) is Givebutter's, and no
   payment data ever touches this site's code.

     widgetId    the widget's id from the Givebutter dashboard — passed in,
                 never built in (the CMS will supply it)
     accountId   the public account id the library loads with
     amount      optional: preselect one of the campaign's existing amounts
     frequency   optional: preselect one of its existing frequencies
     onStatus    optional: "loading" | "ready" | "failed"

   Every value is validated before it reaches the DOM, and only these
   attributes are ever set — nothing else flows through to the element.
   Givebutter ignores an amount or frequency the campaign does not offer;
   it cannot create new ones. */

const WIDGET_ID = /^[A-Za-z0-9]{4,16}$/;
export const GIVEBUTTER_FREQUENCIES = ["once", "monthly", "quarterly", "yearly"];

export const isGivebutterWidgetId = (value) => typeof value === "string" && WIDGET_ID.test(value);

const validAmount = (amount) =>
  typeof amount === "number" && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000 && Math.round(amount * 100) === amount * 100;

export default function GivebutterForm({ widgetId, accountId, amount, frequency, onStatus }) {
  const [status, setStatus] = useState("loading");

  const valid = isGivebutterWidgetId(widgetId);

  useEffect(() => {
    if (!valid) return undefined;
    let current = true;
    loadGivebutter(accountId).then(
      () => current && setStatus("ready"),
      () => current && setStatus("failed")
    );
    return () => {
      current = false;
    };
  }, [accountId, valid]);

  useEffect(() => onStatus?.(status), [status, onStatus]);

  if (!valid) return null;

  const attributes = {
    id: widgetId,
    ...(validAmount(amount) && { amount: String(amount) }),
    ...(GIVEBUTTER_FREQUENCIES.includes(frequency) && { frequency }),
  };

  return (
    <div className="givebutter-form w-full min-w-0" data-donation-provider="givebutter" data-status={status}>
      <givebutter-widget {...attributes} />
    </div>
  );
}
