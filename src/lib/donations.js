/* The browser side of the donation path — Document 22. Talks to RBB's own
   donation endpoints (server/donations/handler.mjs) and loads Razorpay
   Checkout. It decides nothing: the server sets the amount rules and the
   currency, creates the order and says what state a payment is in. A
   Checkout "success" callback is passed to the server to verify, never
   shown as success on its own.

   - POST bodies are JSON: donor details never go in a URL
   - `credentials: "omit"`: no cookies anywhere
   - nothing is logged, stored or sent to analytics */

/* Razorpay's standard Checkout script — the one origin the donation
   page's CSP allows a script from (scripts/security-policy.mjs). Loaded
   only when the donor starts a payment, never on page load. */
export const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const TIMEOUT_MS = 20000;

/* A same-origin path, or an https URL — the same rule as form endpoints. */
export const validApi = (api) => {
  if (typeof api !== "string" || !api) return false;
  if (api.startsWith("/") && !api.startsWith("//")) return true;
  try {
    const url = new URL(api);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

async function call(api, path, { method = "GET", body, idempotencyKey } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${api.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        ...(body && { "Content-Type": "application/json" }),
        ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
      },
      ...(body && { body: JSON.stringify(body) }),
      credentials: "omit",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data: data ?? {} };
  } catch {
    return { status: 0, data: {} };
  } finally {
    clearTimeout(timer);
  }
}

/* The approved amount rules and the public key id, or null if donations
   are not available right now. */
export async function donationConfig(api) {
  const { status, data } = await call(api, "/config");
  return status === 200 && data.ok && data.keyId && data.currency ? data : null;
}

/* { outcome: "ok", order } | "invalid" (fields) | "rate-limited" | "error" */
export async function createOrder(api, details, idempotencyKey) {
  const { status, data } = await call(api, "/order", { method: "POST", body: details, idempotencyKey });
  if (status === 200 && data.ok) return { outcome: "ok", order: data };
  if (status === 422) return { outcome: "invalid", fields: data.fields ?? {} };
  if (status === 429) return { outcome: "rate-limited" };
  return { outcome: "error" };
}

/* The server's verified state for a Checkout result — "unknown" whenever
   it cannot say. */
export async function verifyPayment(api, { reference, orderId, paymentId, signature }) {
  const { status, data } = await call(api, "/verify", {
    method: "POST",
    body: { reference, orderId, paymentId, signature },
  });
  return status === 200 && data.ok ? data.state : "unknown";
}

export async function donationStatus(api, reference) {
  const { status, data } = await call(api, `/status/${encodeURIComponent(reference)}`);
  return status === 200 && data.ok ? data.state : "unknown";
}

/* Load Checkout once. Resolves to the Razorpay constructor, or null. */
let loading = null;
export function loadCheckout() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    script.addEventListener("load", () => {
      clearTimeout(timer);
      resolve(window.Razorpay ?? null);
    });
    script.addEventListener("error", () => {
      clearTimeout(timer);
      loading = null;
      script.remove();
      resolve(null);
    });
    document.head.appendChild(script);
  });
  return loading;
}

export const newAttemptKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
