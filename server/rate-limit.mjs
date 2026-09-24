/* The rate-limit boundary — Document 21 §6.

   `hit(key)` records one attempt and says whether it is allowed. The key
   is a one-way hash of the client address plus the form, so the limiter
   never holds a raw IP address, and nothing here is logged.

   ⚠ This in-memory limiter is correct for one long-lived process (and for
   tests). A serverless platform runs many short-lived instances that do
   not share memory, so in production pass a limiter backed by the
   platform's own rate limiting or a shared store (same interface:
   `hit(key) → Promise<{ allowed: boolean }>`). docs/FORMS_AND_EMAIL.md. */
import { createHash } from "node:crypto";

export const rateKey = (clientIp, formId) =>
  createHash("sha256")
    .update(`${clientIp ?? "unknown"}|${formId}`)
    .digest("base64url")
    .slice(0, 32);

export function createMemoryRateLimiter({
  max = 5,
  windowMs = 600_000,
  now = Date.now,
} = {}) {
  const hits = new Map();
  return {
    async hit(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      recent.push(t);
      hits.set(key, recent);
      /* Forget idle keys so memory does not grow without bound. */
      if (hits.size > 10_000)
        for (const [k, v] of hits) if (t - v[v.length - 1] >= windowMs) hits.delete(k);
      return { allowed: recent.length <= max };
    },
  };
}

/* Is the rate limiting safe for how this runs? — Document 25 §8/§10.

   RATE_LIMIT_STORE      "memory" (default) or "shared". "shared" means the
                         host adapter passes its own limiter (platform rate
                         limiting or a shared store) to the handler.
   RATE_LIMIT_SINGLE_INSTANCE
                         "true" ONLY when the endpoint runs as one long-lived
                         process, where the in-memory limiter really sees
                         every request. Serverless and multi-instance hosts
                         must use "shared".

   Returns a problem string, or null. In LIVE mode a problem turns the
   endpoint off (fail closed): an in-memory limiter spread across many
   instances limits nothing. Test and staging modes are not affected. */
export function rateLimitProblem({ live, store, singleInstance, provided }) {
  if (store === "shared" && !provided)
    return "RATE_LIMIT_STORE=shared but no shared limiter was passed to the handler";
  if (store !== "shared" && store !== "memory") return "RATE_LIMIT_STORE must be memory or shared";
  if (live && store === "memory" && !singleInstance)
    return "in-memory rate limiting in live mode: pass a shared limiter (RATE_LIMIT_STORE=shared) or confirm a single long-lived process (RATE_LIMIT_SINGLE_INSTANCE=true)";
  return null;
}

/* The rate-limit settings every endpoint reads from the environment. */
export const rateLimitSettings = (env, clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null)) => ({
  store: clean(env.RATE_LIMIT_STORE) ?? "memory",
  singleInstance: clean(env.RATE_LIMIT_SINGLE_INSTANCE) === "true",
});
