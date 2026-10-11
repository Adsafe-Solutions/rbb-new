/* The policy editor's pure rules (M19), unit-tested under plain Node
   (scripts/test/policies.test.mjs). The API enforces every one of them;
   these keep the editor from offering what it would refuse, and never
   write any wording — a new policy is EMPTY until RBB supplies its text. */

export const POLICY_IDS = ["privacy", "terms", "donation"] as const;
export type PolicyKey = (typeof POLICY_IDS)[number];

/* The site's names and addresses — fixed: an editor never changes either. */
export const POLICY_INFO: Record<PolicyKey, { label: string; route: string }> = {
  privacy: { label: "Privacy Policy", route: "/privacy" },
  terms: { label: "Terms of Use", route: "/terms" },
  donation: { label: "Donation Policy", route: "/donation-policy" },
};

export const isPolicyId = (id: string): id is PolicyKey => (POLICY_IDS as readonly string[]).includes(id);

/* A policy's parts as the API takes them. */
export interface PolicyPayload {
  title: string;
  effectiveDate?: string;
  lastUpdated?: string;
  intro: string[];
  sections: { id: string; heading: string; body: string[]; items?: string[] }[];
  contactReference?: string;
  relatedPolicies: PolicyKey[];
  seo?: { description: string };
}
export const PART_NAMES = ["title", "effectiveDate", "lastUpdated", "intro", "sections", "contactReference", "relatedPolicies", "seo"] as const;
export type PartName = (typeof PART_NAMES)[number];

/* The editor's working copy: textareas keep exactly what was typed (a
   blank line starts a paragraph, a new line starts a list item) and are
   turned into the contract's lists only for saving and comparing. */
export interface EditorSection {
  id: string;
  heading: string;
  bodyText: string;
  itemsText: string;
}
export interface EditorDraft {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  introText: string;
  sections: EditorSection[];
  contactReference: string;
  relatedPolicies: PolicyKey[];
  seoDescription: string;
}

/* Paragraphs: blank-line separated; line breaks inside one are spaces. */
export const paragraphsFromText = (text: string): string[] =>
  text
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
export const textFromParagraphs = (paragraphs: string[]): string => paragraphs.join("\n\n");
/* List items: one per line. */
export const itemsFromText = (text: string): string[] =>
  text
    .split("\n")
    .map((i) => i.trim())
    .filter(Boolean);
export const textFromItems = (items: string[] | undefined): string => (items ?? []).join("\n");

export const emptySection = (): EditorSection => ({ id: "", heading: "", bodyText: "", itemsText: "" });

/* A new policy: the site's own title and cross-links — no wording. */
type RecordLike = Omit<Partial<PolicyPayload>, "seo" | "relatedPolicies"> & { seo?: { description?: string }; relatedPolicies?: readonly string[] };
export function draftOf(id: PolicyKey, record: RecordLike | null): EditorDraft {
  return {
    title: record?.title ?? POLICY_INFO[id].label,
    effectiveDate: record?.effectiveDate ?? "",
    lastUpdated: record?.lastUpdated ?? "",
    introText: textFromParagraphs(record?.intro ?? []),
    sections: (record?.sections ?? []).map((s) => ({ id: s.id, heading: s.heading, bodyText: textFromParagraphs(s.body), itemsText: textFromItems(s.items) })),
    contactReference: record?.contactReference ?? "",
    relatedPolicies: record ? POLICY_IDS.filter((p) => record.relatedPolicies?.includes(p)) : POLICY_IDS.filter((other) => other !== id),
    seoDescription: record?.seo?.description ?? "",
  };
}

export function payloadOf(d: EditorDraft): PolicyPayload {
  const description = d.seoDescription.trim();
  return {
    title: d.title.trim(),
    ...(d.effectiveDate && { effectiveDate: d.effectiveDate }),
    ...(d.lastUpdated && { lastUpdated: d.lastUpdated }),
    intro: paragraphsFromText(d.introText),
    sections: d.sections.map((s) => {
      const items = itemsFromText(s.itemsText);
      return { id: s.id.trim(), heading: s.heading.trim(), body: paragraphsFromText(s.bodyText), ...(items.length > 0 && { items }) };
    }),
    ...(d.contactReference && { contactReference: d.contactReference }),
    relatedPolicies: POLICY_IDS.filter((p) => d.relatedPolicies.includes(p)),
    ...(description && { seo: { description } }),
  };
}

/* The parts that differ — what a save sends (null clears an optional one). */
export function changedParts(draft: EditorDraft, saved: EditorDraft): Partial<Record<PartName, unknown>> {
  const a = payloadOf(draft) as unknown as Record<string, unknown>;
  const b = payloadOf(saved) as unknown as Record<string, unknown>;
  return Object.fromEntries(PART_NAMES.filter((p) => JSON.stringify(a[p] ?? null) !== JSON.stringify(b[p] ?? null)).map((p) => [p, a[p] ?? null]));
}

/* A section's anchor from its heading: lowercase words joined by hyphens,
   at most 60 characters — the contract's slug. */
export function anchorOf(heading: string): string {
  return heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/* While a NEW section's anchor still follows its heading, it keeps
   following it; once saved (or typed by hand) it stays — a link to
   /privacy#<anchor> must not break when a heading is reworded. */
export function followsHeading(section: EditorSection, savedIds: string[]): boolean {
  return !savedIds.includes(section.id) && (section.id === "" || section.id === anchorOf(section.heading));
}

/* Is this a real calendar date "YYYY-MM-DD"? (The contract's rule.) */
export function isCalendarDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/* What still stops approval — shown before submitting, so nobody submits
   a policy an owner cannot approve. The API checks again. */
export function approvalGaps(p: Pick<PolicyPayload, "effectiveDate" | "lastUpdated" | "sections">): string[] {
  return [...(p.effectiveDate ? [] : ["an effective date"]), ...(p.lastUpdated ? [] : ["a last-updated date"]), ...(p.sections.length > 0 ? [] : ["at least one section"])];
}

/* Problems the editor can show before saving, keyed by the API's paths
   so they sit where the API's own would. */
export function draftProblems(d: EditorDraft): Map<string, string> {
  const problems = new Map<string, string>();
  const p = payloadOf(d);
  if (!p.title) problems.set("title", "A title is required.");
  for (const key of ["effectiveDate", "lastUpdated"] as const) if (p[key] && !isCalendarDate(p[key])) problems.set(key, "Use a real date (YYYY-MM-DD).");
  const seen = new Set<string>();
  p.sections.forEach((s, i) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || s.id.length > 60) problems.set(`sections.${i}.id`, "Lowercase words joined by hyphens, at most 60 characters.");
    else if (seen.has(s.id)) problems.set(`sections.${i}.id`, "Another section already uses this anchor.");
    seen.add(s.id);
    if (!s.heading) problems.set(`sections.${i}.heading`, "A heading is required.");
    if (!s.body.length && !s.items) problems.set(`sections.${i}.body`, "Add a paragraph or a list item.");
  });
  return problems;
}

/* The list's one-line state of a policy: whether it exists, its status,
   whether a version is on the website, its schedule and effective date. */
export interface PolicyRow {
  exists: boolean;
  status: string | null;
  live: boolean;
  scheduledAt: string | null;
  effectiveDate: string | null;
}
export function rowOf(view: { record: { status: string; effectiveDate?: string } | null; live: boolean; schedule: { at: string } | null }): PolicyRow {
  return {
    exists: Boolean(view.record),
    status: view.record?.status ?? null,
    live: view.live,
    scheduledAt: view.record?.status === "approved" ? (view.schedule?.at ?? null) : null,
    effectiveDate: view.record?.effectiveDate ?? null,
  };
}
