import type { FormId } from "./config.ts";

/* Email templates — Document 21 §8–9, ported from the website's form
   server (apps/web/server/email/templates.mjs, retired after M18). Output
   is IDENTICAL for the forms the API takes — test/forms-templates.test.ts
   renders both and compares, so the two cannot drift while both exist.

   Every template returns { subject, html, text }: a table-based,
   inline-styled HTML email and a plain-text version of the same message.

   ⚠ Everything a visitor typed is escaped before it touches HTML (`esc`).
   Subjects never contain visitor input — only the form type and the
   reference — so nothing typed can shape a header.

   ⚠ ACKNOWLEDGEMENTS NEVER QUOTE WHAT THE SUBMITTER WROTE. They go to an
   address anyone can type into the form; echoing the text would let the
   form send arbitrary content, from RBB's domain, to anyone. */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface SubmissionData {
  name: string;
  email: string;
  message: string;
  organization?: string;
  phone?: string;
  topic?: string;
}

const BRAND = "Rising Beyond Borders";
const C = { blue: "#10437C", sky: "#00ADEF", gray: "#F5F7FA", white: "#FFFFFF", ink: "#3A3A3A", green: "#5CB85C", muted: "#575656" };
const FONT = "Arial, Helvetica, sans-serif";

/* Topic labels, matching the contact form's options (apps/web content/forms.js). */
const TOPIC_LABELS: Record<string, string> = {
  general: "A general question",
  donate: "Donate",
  volunteer: "Volunteer",
  fellowship: "Fellowship",
  partner: "Partner With Us",
  travel: "Travel With Us",
};

const FORM_TITLES: Record<FormId, string> = {
  contact: "Contact inquiry",
  volunteer: "Volunteer interest",
  partner: "Partnership inquiry",
  fundraise: "Fundraising inquiry",
};

/* HTML-escape visitor text; keep line breaks as <br>. */
export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const escMultiline = (s: unknown) => esc(s).replace(/\n/g, "<br>");

function layout({ preheader, heading, body }: { preheader: string; heading: string; body: string }) {
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

const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;

function detailRows(rows: [string, string][]) {
  const tr = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-family:${FONT};font-size:14px;color:${C.muted};white-space:nowrap;">${esc(label)}</td><td style="padding:8px 0;vertical-align:top;font-family:${FONT};font-size:15px;color:${C.ink};word-break:break-word;">${value}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid ${C.gray};">${tr}</table>`;
}

function messageBlock(title: string, text: string) {
  return `<h2 style="margin:8px 0 8px;font-family:${FONT};font-size:16px;color:${C.blue};">${esc(title)}</h2>
<div style="background:${C.gray};border-left:4px solid ${C.sky};border-radius:8px;padding:14px 16px;margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};word-break:break-word;">${escMultiline(text)}</div>`;
}

/* A mailto "reply" button: Charcoal on Growth Green (4.59:1). */
function replyButton(email: string, name: string) {
  const href = `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${C.green};border-radius:12px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.ink};text-decoration:none;">Reply to ${esc(name || email)}</a>
</td></tr></table>`;
}

const metaLine = (reference: string, submittedAt: string) =>
  `<p style="margin:0;font-family:${FONT};font-size:13px;color:${C.muted};">Reference ${esc(reference)} · Received ${esc(submittedAt)} (UTC)</p>`;

const MESSAGE_TITLES: Record<FormId, string> = {
  contact: "Message",
  volunteer: "How they would like to help",
  partner: "What they would like to explore",
  fundraise: "What they are planning",
};

/* The notification to RBB's approved inbox for this form. */
export function notification(formId: FormId, data: SubmissionData, { reference, submittedAt }: { reference: string; submittedAt: string }): RenderedEmail {
  const title = FORM_TITLES[formId];
  const rows: [string, string][] = [
    ["Name", esc(data.name)],
    ...(data.organization ? ([["Organization", esc(data.organization)]] as [string, string][]) : []),
    ["Email", esc(data.email)],
    ...(data.phone ? ([["Phone", esc(data.phone)]] as [string, string][]) : []),
    ...(formId === "contact" && data.topic ? ([["Topic", esc(TOPIC_LABELS[data.topic] ?? data.topic)]] as [string, string][]) : []),
  ];
  const html = layout({
    preheader: `${title} from the website — reference ${reference}`,
    heading: `New ${title.toLowerCase()}`,
    body:
      p(`Submitted through the ${esc(title.toLowerCase())} form on the ${BRAND} website.`) +
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
    ...(data.phone ? [`Phone: ${data.phone}`] : []),
    ...(formId === "contact" && data.topic ? [`Topic: ${TOPIC_LABELS[data.topic] ?? data.topic}`] : []),
    "",
    `${MESSAGE_TITLES[formId]}:`,
    data.message,
    "",
    `Reply to this email to answer ${data.name}.`,
    `Reference ${reference} · Received ${submittedAt} (UTC)`,
  ].join("\n");
  return { subject: `New ${title.toLowerCase()} · ${reference}`, html, text };
}

/* PROPOSED acknowledgement copy (only for forms in EMAIL_ACK_FORMS): no
   quotation of the submission, no response time, no promise beyond
   "received". */
const ACK: Record<FormId, { heading: string; received: string }> = {
  contact: { heading: "Thank you for getting in touch", received: "your message" },
  volunteer: { heading: "Thank you for your interest in volunteering", received: "your volunteering interest" },
  partner: { heading: "Thank you for your partnership inquiry", received: "your partnership inquiry" },
  fundraise: { heading: "Thank you for your fundraising inquiry", received: "your fundraising inquiry" },
};

export function acknowledgement(formId: FormId, { reference, submittedAt }: { reference: string; submittedAt: string }): RenderedEmail {
  const a = ACK[formId];
  const html = layout({
    preheader: `We have received ${a.received}.`,
    heading: a.heading,
    body:
      p(`We have received ${esc(a.received)} through the ${BRAND} website.`) +
      p(`If you need to refer to it, please quote reference <strong>${esc(reference)}</strong>.`) +
      p(`If you did not send this, you can ignore this email.`) +
      metaLine(reference, submittedAt),
  });
  const text = `${a.heading}\n\nWe have received ${a.received} through the ${BRAND} website.\nIf you need to refer to it, please quote reference ${reference}.\nIf you did not send this, you can ignore this email.\n\nReference ${reference} · Received ${submittedAt} (UTC)\n${BRAND}`;
  return { subject: `${a.heading} · ${reference}`, html, text };
}
