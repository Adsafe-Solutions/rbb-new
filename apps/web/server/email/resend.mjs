/* Resend delivery — Document 21 §7. The REST API over fetch (server-side
   only), so the site gains no dependency. The API key arrives from the
   handler's config and is used for exactly one header; it is never
   logged, returned or included in an error.

   Returns { ok: true, id } with Resend's message id, or
   { ok: false, category } where category is "rejected" (4xx — a
   configuration problem such as an unverified domain) or "unavailable"
   (5xx, network failure, timeout). Provider response bodies are never
   passed on: the caller logs the category, the user sees a generic
   message. */
const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export async function sendEmail({
  apiKey,
  from,
  to,
  replyTo,
  subject,
  html,
  text,
  idempotencyKey,
  fetchImpl = fetch,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        /* Resend ignores a repeat with the same key (24 h), so a retried
           submission cannot send the same email twice. */
        ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo && { reply_to: replyTo }),
      }),
      signal: controller.signal,
    });
    if (response.ok) {
      const json = await response.json().catch(() => ({}));
      return { ok: true, id: typeof json.id === "string" ? json.id : null };
    }
    return {
      ok: false,
      category:
        response.status >= 500 || response.status === 429 ? "unavailable" : "rejected",
    };
  } catch {
    return { ok: false, category: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
