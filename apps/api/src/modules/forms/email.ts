import { randomUUID } from "node:crypto";
import type { FormsConfig } from "./config.ts";

/* Email delivery for the public forms (M18; Document 21 §7), ported from
   the website's form server. Resend's REST API over fetch — no SDK. The
   key is used for exactly one header and never logged, returned or put
   in an error. Provider response bodies are never passed on.

   The EMAIL_MODE rules:
     off      nothing — the form is not enabled, so nothing gets this far
     test     NOTHING is sent: the message is rendered and handed to
              `capture` (tests, local development)
     staging  sent, but ONLY to EMAIL_TEST_RECIPIENT, subject "[TEST] …"
     live     sent as addressed */

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export type EmailResult = { ok: true; id: string | null } | { ok: false; category: "rejected" | "unavailable" };

/* How an email leaves the server. Tests always pass their own. */
export type EmailTransport = (email: OutgoingEmail, apiKey: string) => Promise<EmailResult>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export const resendTransport =
  (fetchImpl: typeof fetch = fetch): EmailTransport =>
  async (email, apiKey) => {
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          /* Resend ignores a repeat with the same key (24 h): a retried
             submission cannot send the same email twice. */
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({ from: email.from, to: [email.to], subject: email.subject, html: email.html, text: email.text, ...(email.replyTo && { reply_to: email.replyTo }) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as { id?: unknown };
        return { ok: true, id: typeof body.id === "string" ? body.id : null };
      }
      return { ok: false, category: response.status >= 500 || response.status === 429 ? "unavailable" : "rejected" };
    } catch {
      return { ok: false, category: "unavailable" };
    }
  };

/* Under NODE_ENV=test, unless a test passes its own transport: nothing can
   reach a real provider, whatever the environment holds. */
export const refusingTransport: EmailTransport = async () => ({ ok: false, category: "unavailable" });

export type Deliver = (message: Omit<OutgoingEmail, "from" | "idempotencyKey">, idempotencyKey: string) => Promise<EmailResult>;

export function createDeliverer(config: FormsConfig, transport: EmailTransport, capture: (email: OutgoingEmail) => void = () => {}): Deliver {
  return async (message, idempotencyKey) => {
    if (config.mode === "off" || (config.mode !== "test" && !config.from)) return { ok: false, category: "unavailable" };
    const staging = config.mode === "staging";
    const email: OutgoingEmail = {
      from: config.from ?? "test@localhost.invalid",
      to: staging ? config.testRecipient! : message.to,
      ...(message.replyTo && { replyTo: message.replyTo }),
      subject: staging ? `[TEST] ${message.subject}` : message.subject,
      html: message.html,
      text: message.text,
      idempotencyKey,
    };
    if (config.mode === "test") {
      capture(email);
      return { ok: true, id: `test-${randomUUID()}` };
    }
    return transport(email, config.apiKey!);
  };
}
