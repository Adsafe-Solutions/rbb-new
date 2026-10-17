/* The Get Involved editors' pure rules (M20), unit-tested under plain
   Node (scripts/test/get-involved.test.mjs). The API enforces every one of
   them; these keep the editors from offering what it would refuse, and
   never write any wording — a page is EMPTY until RBB supplies its words.
   Paragraph, list and anchor handling is the policies' (M19). */
import { anchorOf, followsHeading, itemsFromText, paragraphsFromText, textFromItems, textFromParagraphs, type EditorSection } from "../policies/rules.ts";

export { anchorOf, followsHeading, type EditorSection };

export const PAGE_IDS = ["hub", "volunteer", "fellowship", "partner", "fundraise", "travel"] as const;
export type PageKey = (typeof PAGE_IDS)[number];
export type PathKey = Exclude<PageKey, "hub">;

/* The site's names and addresses — fixed: an editor never changes either,
   nor a path's title, button label, icon, images or form. */
export const PAGE_INFO: Record<PageKey, { label: string; title: string; route: string }> = {
  hub: { label: "Get Involved page", title: "Get Involved", route: "/get-involved" },
  volunteer: { label: "Volunteer page", title: "Volunteer", route: "/get-involved/volunteer" },
  fellowship: { label: "Fellowship page", title: "Fellowship", route: "/get-involved/fellowship" },
  partner: { label: "Partner With Us page", title: "Partner With Us", route: "/get-involved/partner" },
  fundraise: { label: "Fundraise With Us page", title: "Fundraise With Us", route: "/get-involved/fundraise" },
  travel: { label: "Travel With Us page", title: "Travel With Us", route: "/get-involved/travel" },
};

export const isPageId = (id: string): id is PageKey => (PAGE_IDS as readonly string[]).includes(id);

/* Where a call to action may lead — the six the contract allows, with the
   address the website gives each. Never a typed-in address. */
export const CTA_OPTIONS = [
  { value: "appeals", label: "Appeals (/appeals)" },
  { value: "work", label: "Our Work (/work)" },
  { value: "impact", label: "Our Impact (/impact)" },
  { value: "contact", label: "Contact Us (/contact)" },
  { value: "get-involved", label: "Get Involved (/get-involved)" },
  { value: "about", label: "About Us (/about)" },
] as const;
export type CtaTargetKey = (typeof CTA_OPTIONS)[number]["value"];

/* The section id the path's form section already uses. */
export const RESERVED_SECTION_IDS = ["inquiry"];

/* ---------------- A path ---------------- */

export interface PathPayload {
  shortDescription?: string;
  hubNote?: string;
  sections: { id: string; heading: string; body: string[]; items?: string[] }[];
  faq?: { heading: string; items: { question: string; answer: string }[] };
  seo?: { description: string };
}
export const PATH_PARTS = ["shortDescription", "hubNote", "sections", "faq", "seo"] as const;

/* Textareas keep exactly what was typed; the contract's lists are made
   only for saving and comparing. */
export interface PathDraft {
  shortDescription: string;
  hubNote: string;
  sections: EditorSection[];
  faqOn: boolean;
  faqHeading: string;
  faqItems: { question: string; answer: string }[];
  seoDescription: string;
}

type PathRecordLike = Partial<PathPayload> & { seo?: { description?: string } };
export function pathDraftOf(record: PathRecordLike | null): PathDraft {
  return {
    shortDescription: record?.shortDescription ?? "",
    hubNote: record?.hubNote ?? "",
    sections: (record?.sections ?? []).map((s) => ({ id: s.id, heading: s.heading, bodyText: textFromParagraphs(s.body), itemsText: textFromItems(s.items) })),
    faqOn: Boolean(record?.faq),
    faqHeading: record?.faq?.heading ?? "",
    faqItems: record?.faq?.items.map((i) => ({ ...i })) ?? [],
    seoDescription: record?.seo?.description ?? "",
  };
}

export function pathPayloadOf(d: PathDraft): PathPayload {
  const trim = (v: string) => v.trim() || undefined;
  const short = trim(d.shortDescription);
  const note = trim(d.hubNote);
  const description = trim(d.seoDescription);
  return {
    ...(short && { shortDescription: short }),
    ...(note && { hubNote: note }),
    sections: d.sections.map((s) => {
      const items = itemsFromText(s.itemsText);
      return { id: s.id.trim(), heading: s.heading.trim(), body: paragraphsFromText(s.bodyText), ...(items.length > 0 && { items }) };
    }),
    ...(d.faqOn && { faq: { heading: d.faqHeading.trim(), items: d.faqItems.map((i) => ({ question: i.question.trim(), answer: i.answer.trim() })) } }),
    ...(description && { seo: { description } }),
  };
}

export function pathApprovalGaps(p: PathPayload): string[] {
  return [...(p.shortDescription ? [] : ["a short description"]), ...(p.sections.length > 0 ? [] : ["at least one section"])];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function pathProblems(d: PathDraft): Map<string, string> {
  const problems = new Map<string, string>();
  const p = pathPayloadOf(d);
  const ids = new Set<string>();
  const headings = new Set<string>();
  p.sections.forEach((s, i) => {
    if (!SLUG.test(s.id) || s.id.length > 60) problems.set(`sections.${i}.id`, "Lowercase words joined by hyphens, at most 60 characters.");
    else if (RESERVED_SECTION_IDS.includes(s.id)) problems.set(`sections.${i}.id`, `“${s.id}” is used by the page's form. Choose another anchor.`);
    else if (ids.has(s.id)) problems.set(`sections.${i}.id`, "Another section already uses this anchor.");
    ids.add(s.id);
    if (!s.heading) problems.set(`sections.${i}.heading`, "A heading is required.");
    else if (headings.has(s.heading)) problems.set(`sections.${i}.heading`, "Another section already has this heading.");
    headings.add(s.heading);
    if (!s.body.length && !s.items) problems.set(`sections.${i}.body`, "Add a paragraph or a list item.");
  });
  if (p.faq) {
    if (!p.faq.heading) problems.set("faq.heading", "A heading is required.");
    if (!p.faq.items.length) problems.set("faq.items", "Add a question, or turn the questions off.");
    const asked = new Set<string>();
    p.faq.items.forEach((item, i) => {
      if (!item.question) problems.set(`faq.items.${i}.question`, "A question is required.");
      else if (asked.has(item.question)) problems.set(`faq.items.${i}.question`, "This question is already asked above.");
      asked.add(item.question);
      if (!item.answer) problems.set(`faq.items.${i}.answer`, "An answer is required.");
    });
  }
  return problems;
}

/* ---------------- The hub ---------------- */

export interface Cta {
  label: string;
  target: CtaTargetKey | "";
}
export interface HubPayload {
  heading?: string;
  intro?: string;
  ways?: { kicker: string; heading: string };
  choose?: { kicker: string; heading: string };
  why?: { heading: string; body: string[] };
  closing?: { heading: string; primary: { label: string; target: string }; secondary?: { label: string; target: string } };
}
export const HUB_PARTS = ["heading", "intro", "ways", "choose", "why", "closing"] as const;

export interface HubDraft {
  heading: string;
  intro: string;
  waysKicker: string;
  waysHeading: string;
  chooseKicker: string;
  chooseHeading: string;
  whyOn: boolean;
  whyHeading: string;
  whyText: string;
  closingOn: boolean;
  closingHeading: string;
  primary: Cta;
  secondaryOn: boolean;
  secondary: Cta;
}

const emptyCta = (): Cta => ({ label: "", target: "" });
export function hubDraftOf(record: HubPayload | null): HubDraft {
  const c = record?.closing;
  return {
    heading: record?.heading ?? "",
    intro: record?.intro ?? "",
    waysKicker: record?.ways?.kicker ?? "",
    waysHeading: record?.ways?.heading ?? "",
    chooseKicker: record?.choose?.kicker ?? "",
    chooseHeading: record?.choose?.heading ?? "",
    whyOn: Boolean(record?.why),
    whyHeading: record?.why?.heading ?? "",
    whyText: textFromParagraphs(record?.why?.body ?? []),
    closingOn: Boolean(c),
    closingHeading: c?.heading ?? "",
    primary: c ? { label: c.primary.label, target: c.primary.target as CtaTargetKey } : emptyCta(),
    secondaryOn: Boolean(c?.secondary),
    secondary: c?.secondary ? { label: c.secondary.label, target: c.secondary.target as CtaTargetKey } : emptyCta(),
  };
}

/* A pair (kicker + heading) is both or neither: empty, the website keeps
   its own; half-filled is a problem (`hubProblems`), sent as typed. */
const pair = (kicker: string, heading: string) => (kicker.trim() || heading.trim() ? { kicker: kicker.trim(), heading: heading.trim() } : undefined);
const cta = (c: Cta) => ({ label: c.label.trim(), target: c.target });

export function hubPayloadOf(d: HubDraft): HubPayload {
  const ways = pair(d.waysKicker, d.waysHeading);
  const choose = pair(d.chooseKicker, d.chooseHeading);
  return {
    ...(d.heading.trim() && { heading: d.heading.trim() }),
    ...(d.intro.trim() && { intro: d.intro.trim() }),
    ...(ways && { ways }),
    ...(choose && { choose }),
    ...(d.whyOn && { why: { heading: d.whyHeading.trim(), body: paragraphsFromText(d.whyText) } }),
    ...(d.closingOn && { closing: { heading: d.closingHeading.trim(), primary: cta(d.primary), ...(d.secondaryOn && { secondary: cta(d.secondary) }) } }),
  };
}

export function hubApprovalGaps(p: HubPayload): string[] {
  return [...(p.heading ? [] : ["a heading"]), ...(p.intro ? [] : ["an introduction"])];
}

export function hubProblems(d: HubDraft): Map<string, string> {
  const problems = new Map<string, string>();
  const p = hubPayloadOf(d);
  for (const key of ["ways", "choose"] as const) {
    const v = p[key];
    if (v && !v.kicker) problems.set(`${key}.kicker`, "Fill in both, or leave both empty to keep the website's words.");
    if (v && !v.heading) problems.set(`${key}.heading`, "Fill in both, or leave both empty to keep the website's words.");
  }
  if (p.why) {
    if (!p.why.heading) problems.set("why.heading", "A heading is required.");
    if (!p.why.body.length) problems.set("why.body", "Add at least one paragraph.");
  }
  if (p.closing) {
    if (!p.closing.heading) problems.set("closing.heading", "A heading is required.");
    for (const key of ["primary", "secondary"] as const) {
      const c = p.closing[key];
      if (!c) continue;
      if (!c.label) problems.set(`closing.${key}.label`, "A button label is required.");
      if (!CTA_OPTIONS.some((o) => o.value === c.target)) problems.set(`closing.${key}.target`, "Choose where the button leads.");
    }
  }
  return problems;
}

/* ---------------- Both ---------------- */

/* The parts that differ — what a save sends (null clears an optional one). */
export function changedParts<P extends object>(parts: readonly string[], draft: P, saved: P): Record<string, unknown> {
  const a = draft as Record<string, unknown>;
  const b = saved as Record<string, unknown>;
  return Object.fromEntries(parts.filter((p) => JSON.stringify(a[p] ?? null) !== JSON.stringify(b[p] ?? null)).map((p) => [p, a[p] ?? null]));
}

/* The list's one-line state of a page. */
export function rowOf(view: { record: { status: string } | null; live: boolean; schedule: { at: string } | null }) {
  return { exists: Boolean(view.record), status: view.record?.status ?? null, live: view.live, scheduledAt: view.record?.status === "approved" ? (view.schedule?.at ?? null) : null };
}
