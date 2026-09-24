/* Razorpay, server side — Document 22 §7–9. The REST API over fetch (no
   SDK, so the site gains no dependency), and the two signature checks.

   The key secret is used for exactly one header (HTTP Basic auth) and the
   HMACs below; it is never logged, returned or put in an error. Provider
   response bodies never leave this file: callers get { ok, data } or
   { ok: false, category } — "rejected" (4xx: a bad request or bad
   credentials) or "unavailable" (5xx, 429, network, timeout).

   Test and live use the same API; the key decides which account and mode
   a call reaches (server/donations/config.mjs keeps them apart). */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

/* Provider ids are letters and digits after a fixed prefix. Anything
   else is refused before it reaches a URL path. */
export const ORDER_ID = /^order_[A-Za-z0-9]{8,40}$/;
export const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,40}$/;
const SIGNATURE = /^[a-f0-9]{64}$/;

export function createRazorpayClient({ keyId, keySecret, fetchImpl = fetch }) {
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  async function call(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: auth,
          ...(body && { "Content-Type": "application/json" }),
        },
        ...(body && { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      if (response.ok) return { ok: true, data: await response.json() };
      return {
        ok: false,
        category: response.status >= 500 || response.status === 429 ? "unavailable" : "rejected",
      };
    } catch {
      return { ok: false, category: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /* amount: integer minor units. receipt: our reference (≤ 40 chars).
       notes: at most 15 short string pairs. */
    createOrder: ({ amount, currency, receipt, notes }) =>
      call("POST", "/orders", { amount, currency, receipt, notes }),
    fetchOrder: (orderId) =>
      ORDER_ID.test(orderId)
        ? call("GET", `/orders/${orderId}`)
        : Promise.resolve({ ok: false, category: "rejected" }),
    fetchPayment: (paymentId) =>
      PAYMENT_ID.test(paymentId)
        ? call("GET", `/payments/${paymentId}`)
        : Promise.resolve({ ok: false, category: "rejected" }),
    fetchOrderPayments: (orderId) =>
      ORDER_ID.test(orderId)
        ? call("GET", `/orders/${orderId}/payments`)
        : Promise.resolve({ ok: false, category: "rejected" }),
    /* The order made for one of our references (the receipt field). */
    findOrderByReceipt: (receipt) =>
      call("GET", `/orders?receipt=${encodeURIComponent(receipt)}&count=1`),
  };
}

const hmacHex = (secret, text) => createHmac("sha256", secret).update(text, "utf8").digest("hex");

/* Constant-time comparison of two hex strings of the same length. */
function sameHex(expected, received) {
  if (typeof received !== "string" || !SIGNATURE.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/* Checkout's success callback: HMAC-SHA256 of "order_id|payment_id" with
   the KEY SECRET. Proves the payment id was issued for this order — not
   that money moved (the payment's own status says that). */
export const verifyPaymentSignature = ({ orderId, paymentId, signature, keySecret }) =>
  ORDER_ID.test(orderId ?? "") &&
  PAYMENT_ID.test(paymentId ?? "") &&
  sameHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);

/* A webhook: HMAC-SHA256 of the RAW request body (the exact bytes, before
   any JSON parsing) with the WEBHOOK SECRET, sent as X-Razorpay-Signature. */
export const verifyWebhookSignature = ({ rawBody, signature, webhookSecret }) =>
  typeof rawBody === "string" && sameHex(hmacHex(webhookSecret, rawBody), signature);
