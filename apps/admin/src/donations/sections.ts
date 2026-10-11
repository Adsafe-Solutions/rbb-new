import type { RichText, Section } from "@rbb/content-schema";

/* Milestone 7: a donation page's sections, as the editor changes them —
   pure, so the rules are tested on their own (scripts/test).

   The sections a donation page draws, in the order it draws them:
     why       one "why it matters" passage — a statement (kicker, heading,
               highlight, paragraphs, link) or formatted text (heading, rich
               text). Edited as what it is: a statement is never turned into
               formatted text unless the editor chooses to.
     helps     one list of how support helps (numbered cards)
     lists     up to three appeal lists (appealList)
     trust     one trust panel
     faq       one set of questions

   A trust panel, FAQ or appeal list in the record is the page's own; one
   saved switched off (enabled: false) means none on this page; none in the
   record means the site's (the website: scripts/snapshot-adapter.mjs).
   Sections of other types already in the record are kept where they are. */

export type DonationSection = Section;
type OfType<T extends Section["type"]> = Extract<Section, { type: T }>;
export type WhySection = OfType<"statement"> | OfType<"richText">;
export type ListSection = OfType<"appealList">;

const ORDER: Record<string, number> = { statement: 0, richText: 0, numberedCards: 1, appealList: 2, trust: 3, faq: 4 };
export const MAX_LISTS = 3;

export const isWhy = (s: Section): s is WhySection => s.type === "statement" || s.type === "richText";
export const whyOf = (sections: Section[]) => sections.find(isWhy) ?? null;
export const sectionOf = <T extends Section["type"]>(sections: Section[], type: T) => (sections.find((s) => s.type === type) as OfType<T> | undefined) ?? null;
export const listsOf = (sections: Section[]) => sections.filter((s): s is ListSection => s.type === "appealList");

/* An id not yet used on the page: `base`, else `base-2`, `base-3`… */
export function freshId(sections: Section[], base: string): string {
  const used = new Set(sections.map((s) => s.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/* Put `section` in place of the one `match` finds (or remove it, given
   null). A new one goes where the page draws it: after every section that
   comes before it in ORDER. */
export function replaceOne(sections: Section[], match: (s: Section) => boolean, section: Section | null): Section[] {
  const at = sections.findIndex(match);
  if (at >= 0) return section ? sections.map((s, i) => (i === at ? section : s)) : sections.filter((_, i) => i !== at);
  if (!section) return sections;
  const rank = ORDER[section.type] ?? 99;
  let insert = sections.length;
  for (let i = 0; i < sections.length; i++)
    if ((ORDER[sections[i]!.type] ?? 99) > rank) {
      insert = i;
      break;
    }
  return [...sections.slice(0, insert), section, ...sections.slice(insert)];
}

/* Replace every appeal list with `lists`, at the place the first one held
   (or where lists are drawn). */
export function replaceLists(sections: Section[], lists: ListSection[]): Section[] {
  const first = sections.findIndex((s) => s.type === "appealList");
  const rest = sections.filter((s) => s.type !== "appealList");
  if (!lists.length) return rest;
  const at = first >= 0 ? sections.slice(0, first).filter((s) => s.type !== "appealList").length : (() => {
    const i = rest.findIndex((s) => (ORDER[s.type] ?? 99) > ORDER.appealList!);
    return i < 0 ? rest.length : i;
  })();
  return [...rest.slice(0, at), ...lists, ...rest.slice(at)];
}

/* Statement paragraphs ↔ formatted text, for an editor switching the
   passage's form. Formatted text keeps only its words when it becomes
   paragraphs (a heading or list item becomes a paragraph of its own). */
export const paragraphsToRichText = (body: string[]): RichText => body.filter((p) => p.trim()).map((text) => ({ type: "paragraph", children: [{ type: "text", text }] }));
const inlineText = (nodes: unknown): string =>
  Array.isArray(nodes) ? nodes.map((n) => (n && typeof n === "object" ? ("text" in n ? String((n as { text: string }).text) : inlineText((n as { children?: unknown }).children)) : "")).join("") : "";
export function richTextToParagraphs(content: RichText): string[] {
  const out: string[] = [];
  for (const block of content as unknown as Record<string, unknown>[]) {
    if (Array.isArray(block.items)) for (const item of block.items) out.push(inlineText(item));
    else out.push(inlineText(block.children));
  }
  return out.map((p) => p.trim()).filter(Boolean);
}
