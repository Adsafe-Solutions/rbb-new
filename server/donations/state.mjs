/* Donation states — Document 22 §4. There is NO database: a donation's
   state is read from Razorpay, the system of record, every time it is
   needed. The order carries our reference (its `receipt` and
   notes.rbb_reference); its payments carry what happened.

     created          order made, nothing attempted yet
     checkout_opened  the donor has the Checkout open        ┐ browser-only:
     cancelled        the donor closed Checkout without      │ Razorpay has
                      paying                                 ┘ no such state
     authorized       the bank approved; not yet captured — "processing"
     captured         money taken. The ONLY success state
     failed           every attempt failed
     refunded         a refund Razorpay reports as processed
     unknown          anything that cannot be read safely — never success

   `checkout_opened` and `cancelled` exist only in the browser
   (components/DonationCheckout): the server cannot see them and never
   claims to. */
export const STATES = [
  "created",
  "checkout_opened",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
  "unknown",
];

/* One payment's status → a donation state. */
export function paymentState(payment) {
  if (!payment || typeof payment.status !== "string") return "unknown";
  if (payment.status === "refunded" || payment.amount_refunded > 0) return "refunded";
  if (payment.status === "captured") return "captured";
  if (payment.status === "authorized") return "authorized";
  if (payment.status === "failed") return "failed";
  if (payment.status === "created") return "created";
  return "unknown";
}

/* An order's payments → the donation's state. One success outranks any
   number of failed attempts (a donor may retry inside Checkout). */
const RANK = ["refunded", "captured", "authorized", "created", "failed"];
export function orderState(order, payments = []) {
  if (!order || typeof order.status !== "string") return "unknown";
  const states = payments.map(paymentState);
  for (const s of RANK) if (states.includes(s)) return s;
  if (states.includes("unknown")) return "unknown";
  return order.status === "created" || order.status === "attempted" ? "created" : "unknown";
}

/* Does this payment belong to this order, and this order to this
   reference and this configuration? Every check must hold before a
   payment's status is believed. */
export function consistent({ order, payment, reference, config }) {
  if (!order || !payment) return false;
  if (reference && (order.receipt !== reference || order.notes?.rbb_reference !== reference))
    return false;
  if (payment.order_id !== order.id) return false;
  if (order.currency !== config.currency || payment.currency !== order.currency) return false;
  if (!Number.isSafeInteger(order.amount) || payment.amount !== order.amount) return false;
  return true;
}
