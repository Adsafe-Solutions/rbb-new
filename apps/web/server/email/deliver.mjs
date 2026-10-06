/* The one way the server sends an email — Document 21's EMAIL_MODE rules,
   shared by the form endpoint and the donation endpoints (Document 22) so
   there is a single Resend client (./resend.mjs) and a single set of
   test/staging/live rules:

     off      nothing is sent — the caller should not get this far
     test     nothing is sent; the email goes to `capture` instead
     staging  sent, but to EMAIL_TEST_RECIPIENT only, subject "[TEST] …"
     live     sent as addressed

   `message` = { to, replyTo?, subject, html, text }. Returns
   { ok: true, id } or { ok: false, category } (see ./resend.mjs). */
import { randomUUID } from "node:crypto";
import { sendEmail } from "./resend.mjs";

export function createDeliverer({ config, fetchImpl = fetch, capture = () => {} }) {
  return async function deliver(message, idempotencyKey) {
    if (config.mode === "off") return { ok: false, category: "unavailable" };
    const staging = config.mode === "staging";
    const email = {
      from: config.from,
      to: staging ? config.testRecipient : message.to,
      replyTo: message.replyTo,
      subject: staging ? `[TEST] ${message.subject}` : message.subject,
      html: message.html,
      text: message.text,
      idempotencyKey,
    };
    if (config.mode === "test") {
      await capture(email);
      return { ok: true, id: `test-${randomUUID()}` };
    }
    return sendEmail({ ...email, apiKey: config.apiKey, fetchImpl });
  };
}
