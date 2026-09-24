/* Email templates — Document 21 §8–9. Every template returns
   { subject, html, text }: a table-based, inline-styled HTML email that
   holds up in old clients, and a plain-text version of the same message.

   ⚠ Everything a visitor typed is escaped before it touches HTML
   (`esc`). Subjects never contain visitor input — only the form type and
   the reference — so nothing typed can shape a header.

   ⚠ ACKNOWLEDGEMENTS NEVER QUOTE WHAT THE SUBMITTER WROTE. They go to an
   address anyone can type into the form; echoing the submitted text would
   let the form be used to send arbitrary content, from RBB's domain, to
   anyone. They say only that a message was received, with its reference.

   Brand: Deep Trust Blue #10437C, Sky Blue #00ADEF, Light Gray #F5F7FA,
   White #FFFFFF, Charcoal #3A3A3A, Growth Green #5CB85C (buttons carry
   Charcoal text on green — Document 16). No logo image and no photograph:
   no approved public logo URL exists yet, so the name is set in text. The
   footer carries the name only until RBB approves its details.

   Acknowledgement and newsletter wording is PROPOSED — shown only in forms
   RBB enables acknowledgements for (EMAIL_ACK_FORMS), after approval. It
   makes no promise of a reply or a response time. */

const BRAND = "Rising Beyond Borders";
const C = {
  blue: "#10437C",
  sky: "#00ADEF",
  gray: "#F5F7FA",
  white: "#FFFFFF",
  ink: "#3A3A3A",
  green: "#5CB85C",
  muted: "#575656",
};
const FONT = "Arial, Helvetica, sans-serif";

/* Topic labels, matching the contact form's options (content/forms.js). */
const TOPIC_LABELS = {
  general: "A general question",
  donate: "Donate",
  volunteer: "Volunteer",
  partner: "Partner With Us",
  fundraise: "Fundraise",
};

const FORM_TITLES = {
  contact: "Contact inquiry",
  volunteer: "Volunteer interest",
  partner: "Partnership inquiry",
  fundraise: "Fundraising inquiry",
  newsletter: "Newsletter sign-up",
};

/* HTML-escape visitor text; keep line breaks as <br>. */
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const escMultiline = (s) => esc(s).replace(/\n/g, "<br>");

/* The shared frame: header band, white card, footer. `preheader` is the
   inbox preview line (hidden in the body). */
function layout({ preheader, heading, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.gray};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.gray};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:${C.blue};padding:22px 28px;border-radius:16px 16px 0 0;font-family:${FONT};font-size:20px;font-weight:bold;color:${C.white};">${BRAND}</td></tr>
<tr><td style="background:${C.sky};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="background:${C.white};padding:28px;border-radius:0 0 16px 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.ink};">
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.blue};">${esc(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 28px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};text-align:center;">${BRAND}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const p = (html) => `<p style="margin:0 0 14px;">${html}</p>`;

/* Label/value rows for the notification's details. */
function detailRows(rows) {
  const tr = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-family:${FONT};font-size:14px;color:${C.muted};white-space:nowrap;">${esc(label)}</td><td style="padding:8px 0;vertical-align:top;font-family:${FONT};font-size:15px;color:${C.ink};word-break:break-word;">${value}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid ${C.gray};">${tr}</table>`;
}

function messageBlock(title, text) {
  return `<h2 style="margin:8px 0 8px;font-family:${FONT};font-size:16px;color:${C.blue};">${esc(title)}</h2>
<div style="background:${C.gray};border-left:4px solid ${C.sky};border-radius:8px;padding:14px 16px;margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};word-break:break-word;">${escMultiline(text)}</div>`;
}

/* A mailto "reply" button: Charcoal on Growth Green (4.59:1). */
function replyButton(email, name) {
  const href = `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${C.green};border-radius:12px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.ink};text-decoration:none;">Reply to ${esc(name || email)}</a>
</td></tr></table>`;
}

const metaLine = (reference, submittedAt) =>
  `<p style="margin:0;font-family:${FONT};font-size:13px;color:${C.muted};">Reference ${esc(reference)} · Received ${esc(submittedAt)} (UTC)</p>`;

/* ---------------- Notifications (to RBB) ---------------- */

const MESSAGE_TITLES = {
  contact: "Message",
  volunteer: "How they would like to help",
  partner: "What they would like to explore",
  fundraise: "What they are planning",
};

export function notification(formId, data, { reference, submittedAt }) {
  const title = FORM_TITLES[formId];
  const rows = [
    ["Name", esc(data.name)],
    ...(data.organization ? [["Organization", esc(data.organization)]] : []),
    ["Email", esc(data.email)],
    ...(formId === "contact" && data.topic
      ? [["Topic", esc(TOPIC_LABELS[data.topic] ?? data.topic)]]
      : []),
  ];
  const html = layout({
    preheader: `${title} from the website — reference ${reference}`,
    heading: `New ${title.toLowerCase()}`,
    body:
      p(
        `Submitted through the ${esc(title.toLowerCase())} form on the ${BRAND} website.`
      ) +
      detailRows(rows) +
      messageBlock(MESSAGE_TITLES[formId], data.message) +
      replyButton(data.email, data.name) +
      metaLine(reference, submittedAt),
  });
  const text = [
    `New ${title.toLowerCase()} — ${BRAND} website`,
    "",
    `Name: ${data.name}`,
    ...(data.organization ? [`Organization: ${data.organization}`] : []),
    `Email: ${data.email}`,
    ...(formId === "contact" && data.topic
      ? [`Topic: ${TOPIC_LABELS[data.topic] ?? data.topic}`]
      : []),
    "",
    `${MESSAGE_TITLES[formId]}:`,
    data.message,
    "",
    `Reply to this email to answer ${data.name}.`,
    `Reference ${reference} · Received ${submittedAt} (UTC)`,
  ].join("\n");
  return { subject: `New ${title.toLowerCase()} · ${reference}`, html, text };
}

/* Newsletter sign-up notice to RBB (subscriber management is pending). */
export function newsletterNotification(data, { reference, submittedAt }) {
  const html = layout({
    preheader: `Newsletter sign-up — reference ${reference}`,
    heading: "New newsletter sign-up",
    body:
      detailRows([
        ["Email", esc(data.email)],
        ["Consent", "Given on the sign-up form"],
      ]) + metaLine(reference, submittedAt),
  });
  const text = `New newsletter sign-up — ${BRAND} website\n\nEmail: ${data.email}\nConsent: given on the sign-up form\n\nReference ${reference} · Received ${submittedAt} (UTC)`;
  return { subject: `New newsletter sign-up · ${reference}`, html, text };
}

/* ---------------- Acknowledgements (to the submitter) ----------------
   PROPOSED copy. No quotation of the submission (see header), no response
   time, no promise beyond "received". */

const ACK = {
  contact: { heading: "Thank you for getting in touch", received: "your message" },
  volunteer: {
    heading: "Thank you for your interest in volunteering",
    received: "your volunteering interest",
  },
  partner: {
    heading: "Thank you for your partnership inquiry",
    received: "your partnership inquiry",
  },
  fundraise: {
    heading: "Thank you for your fundraising inquiry",
    received: "your fundraising inquiry",
  },
};

export function acknowledgement(formId, { reference, submittedAt }) {
  const a = ACK[formId];
  const html = layout({
    preheader: `We have received ${a.received}.`,
    heading: a.heading,
    body:
      p(`We have received ${esc(a.received)} through the ${BRAND} website.`) +
      p(
        `If you need to refer to it, please quote reference <strong>${esc(reference)}</strong>.`
      ) +
      p(`If you did not send this, you can ignore this email.`) +
      metaLine(reference, submittedAt),
  });
  const text = `${a.heading}\n\nWe have received ${a.received} through the ${BRAND} website.\nIf you need to refer to it, please quote reference ${reference}.\nIf you did not send this, you can ignore this email.\n\nReference ${reference} · Received ${submittedAt} (UTC)\n${BRAND}`;
  return { subject: `${a.heading} · ${reference}`, html, text };
}

/* Newsletter confirmation to the subscriber. PROPOSED; the confirmation
   link and unsubscribe process depend on the subscriber-management
   decision — without a `confirmUrl` the email says only that the sign-up
   was received. */
export function newsletterConfirmation({
  reference,
  submittedAt,
  confirmUrl = null,
  unsubscribeText = null,
}) {
  const confirm = confirmUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${C.green};border-radius:12px;"><a href="${esc(confirmUrl)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.ink};text-decoration:none;">Confirm your subscription</a></td></tr></table>`
    : "";
  const html = layout({
    preheader: "Your newsletter sign-up was received.",
    heading: "Your newsletter sign-up",
    body:
      p(
        `We have received a request to sign this address up to the ${BRAND} newsletter.`
      ) +
      confirm +
      (unsubscribeText ? p(esc(unsubscribeText)) : "") +
      p("If you did not ask for this, you can ignore this email.") +
      metaLine(reference, submittedAt),
  });
  const text = [
    "Your newsletter sign-up",
    "",
    `We have received a request to sign this address up to the ${BRAND} newsletter.`,
    ...(confirmUrl ? [`Confirm your subscription: ${confirmUrl}`] : []),
    ...(unsubscribeText ? [unsubscribeText] : []),
    "If you did not ask for this, you can ignore this email.",
    "",
    `Reference ${reference} · Received ${submittedAt} (UTC)`,
    BRAND,
  ].join("\n");
  return { subject: `Your newsletter sign-up · ${reference}`, html, text };
}

/* ---------------- Donations — Document 22 §10–11 ----------------

   Sent ONLY from server-verified payment state (server/donations/): a
   signature-checked Checkout callback confirmed against Razorpay's own
   record, or a signature-checked webhook. Never from the browser.

   What they may say is limited on purpose:
     - amounts are the VERIFIED amount, in the configured currency
     - no tax-deductibility, receipt, refund-policy, purpose or support
       line unless RBB has approved its exact wording
       (server/donations/wording.mjs) — those slots are empty today
     - no card, bank, UPI or wallet detail, no signature, no provider
       payload; the internal notice carries the Razorpay ids needed to
       reconcile, nothing more
     - donor text (the name) is escaped like any visitor input
   The rest of the wording is PROPOSED and each donor email is off until
   RBB approves it (DONATION_DONOR_EMAILS). A test-mode payment says so in
   every email, so a test can never be mistaken for a real gift. */

const testLine = (mode) =>
  mode === "test"
    ? {
        html: `<p style="margin:0 0 14px;padding:10px 14px;border-radius:8px;background:${C.gray};font-family:${FONT};font-size:14px;color:${C.ink};"><strong>Test payment.</strong> Made in Razorpay test mode — no money moved.</p>`,
        text: "TEST PAYMENT — made in Razorpay test mode, no money moved.\n\n",
        subject: "[Razorpay test] ",
      }
    : { html: "", text: "", subject: "" };

/* The approved lines, when RBB has supplied them, in a fixed order. */
const approvedLines = (lines) => lines.filter((l) => typeof l === "string" && l.trim());

const donationMeta = (reference, at) =>
  `<p style="margin:0;font-family:${FONT};font-size:13px;color:${C.muted};">Donation reference ${esc(reference)} · ${esc(at)} (UTC)</p>`;

function donorEmail({ mode, preheader, heading, lines, approved = [], reference, at, subject }) {
  const t = testLine(mode);
  const extra = approvedLines(approved);
  const html = layout({
    preheader,
    heading,
    body:
      t.html +
      lines.map((l) => p(l.html)).join("") +
      extra.map((l) => p(esc(l))).join("") +
      p("If you did not make this donation, you can ignore this email.") +
      donationMeta(reference, at),
  });
  const text = [
    t.text + heading,
    "",
    ...lines.map((l) => l.text),
    ...extra,
    "If you did not make this donation, you can ignore this email.",
    "",
    `Donation reference ${reference} · ${at} (UTC)`,
    BRAND,
  ].join("\n");
  return { subject: `${t.subject}${subject} · ${reference}`, html, text };
}

/* Donor — payment CAPTURED and verified. `amount` is display text of the
   verified amount ("INR 1,500.00"). */
export function donationSuccess({ mode, reference, amount, at, wording = {} }) {
  return donorEmail({
    mode,
    reference,
    at,
    subject: "Thank you for your donation",
    preheader: `Your donation of ${amount} has been received.`,
    heading: "Thank you for your donation",
    lines: [
      {
        html: `Your donation of <strong>${esc(amount)}</strong> to ${BRAND} has been received and confirmed.`,
        text: `Your donation of ${amount} to ${BRAND} has been received and confirmed.`,
      },
      {
        html: `Your donation reference is <strong>${esc(reference)}</strong>. Please quote it if you contact us about this donation.`,
        text: `Your donation reference is ${reference}. Please quote it if you contact us about this donation.`,
      },
    ],
    approved: [wording.purpose, wording.receipt, wording.support],
  });
}

/* Donor — AUTHORIZED, not yet captured. Must not read as success. */
export function donationProcessing({ mode, reference, amount, at, wording = {} }) {
  return donorEmail({
    mode,
    reference,
    at,
    subject: "Your donation is being confirmed",
    preheader: "Your payment is being confirmed.",
    heading: "Your donation is being confirmed",
    lines: [
      {
        html: `We have received your payment of <strong>${esc(amount)}</strong> and it is waiting to be confirmed by the payment provider. It is not complete yet.`,
        text: `We have received your payment of ${amount} and it is waiting to be confirmed by the payment provider. It is not complete yet.`,
      },
      {
        html: `Your donation reference is <strong>${esc(reference)}</strong>.`,
        text: `Your donation reference is ${reference}.`,
      },
    ],
    approved: [wording.support],
  });
}

/* Donor — the payment FAILED. Says what is known (the payment did not go
   through) and nothing about charges or refunds, which it cannot know. */
export function donationFailed({ mode, reference, at, retryUrl = null, wording = {} }) {
  return donorEmail({
    mode,
    reference,
    at,
    subject: "Your donation was not completed",
    preheader: "Your payment was not completed.",
    heading: "Your donation was not completed",
    lines: [
      {
        html: `Your payment to ${BRAND} was not completed, so this donation (reference <strong>${esc(reference)}</strong>) has not been made.`,
        text: `Your payment to ${BRAND} was not completed, so this donation (reference ${reference}) has not been made.`,
      },
      ...(retryUrl
        ? [
            {
              html: `You can try again on our <a href="${esc(retryUrl)}" style="color:${C.blue};font-weight:bold;">donation page</a>.`,
              text: `You can try again on our donation page: ${retryUrl}`,
            },
          ]
        : []),
    ],
    approved: [wording.support],
  });
}

/* Donor — a refund Razorpay reports as PROCESSED. */
export function donationRefunded({ mode, reference, amount, refundId, at, wording = {} }) {
  return donorEmail({
    mode,
    reference,
    at,
    subject: "Your donation has been refunded",
    preheader: `A refund of ${amount} has been processed.`,
    heading: "Your donation has been refunded",
    lines: [
      {
        html: `A refund of <strong>${esc(amount)}</strong> for donation <strong>${esc(reference)}</strong> has been processed.`,
        text: `A refund of ${amount} for donation ${reference} has been processed.`,
      },
      {
        html: `Refund reference: ${esc(refundId)}.`,
        text: `Refund reference: ${refundId}.`,
      },
    ],
    approved: [wording.refund, wording.support],
  });
}

/* RBB — one notice per verified event. `event` is "captured" or
   "refunded". The donor details are the ones given on the donation form;
   the ids are what reconciliation against the Razorpay dashboard needs. */
export function donationNotification({
  mode,
  event,
  reference,
  amount,
  donor,
  orderId,
  paymentId,
  refundId = null,
  at,
}) {
  const t = testLine(mode);
  const title = event === "refunded" ? "Donation refunded" : "Donation received";
  const rows = [
    ["Amount", `<strong>${esc(amount)}</strong>`],
    ["Name", esc(donor.name || "—")],
    ["Email", esc(donor.email || "—")],
    ...(donor.phone ? [["Phone", esc(donor.phone)]] : []),
    ["Reference", esc(reference)],
    ["Razorpay order", esc(orderId)],
    ["Razorpay payment", esc(paymentId)],
    ...(refundId ? [["Razorpay refund", esc(refundId)]] : []),
    ["Mode", esc(mode)],
  ];
  const html = layout({
    preheader: `${title}: ${amount} — ${reference}`,
    heading: title,
    body:
      t.html +
      p(
        event === "refunded"
          ? "Razorpay reports this refund as processed."
          : "Payment verified with Razorpay and captured."
      ) +
      detailRows(rows) +
      donationMeta(reference, at),
  });
  const text = [
    t.text + `${title} — ${BRAND} website`,
    "",
    event === "refunded"
      ? "Razorpay reports this refund as processed."
      : "Payment verified with Razorpay and captured.",
    "",
    `Amount: ${amount}`,
    `Name: ${donor.name || "—"}`,
    `Email: ${donor.email || "—"}`,
    ...(donor.phone ? [`Phone: ${donor.phone}`] : []),
    `Reference: ${reference}`,
    `Razorpay order: ${orderId}`,
    `Razorpay payment: ${paymentId}`,
    ...(refundId ? [`Razorpay refund: ${refundId}`] : []),
    `Mode: ${mode}`,
    "",
    `${at} (UTC)`,
  ].join("\n");
  return { subject: `${t.subject}${title} · ${amount} · ${reference}`, html, text };
}
