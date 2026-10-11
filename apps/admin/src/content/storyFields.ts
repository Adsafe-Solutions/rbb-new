/* Milestone 5: a story's quotes and impact, as the editor handles them.
   The contract (packages/content-schema posts/post.ts StoryQuotes,
   StoryImpact) is the rule; these mirror it so a problem shows beside the
   item before saving, and the API checks it again.

   An emptied list is no list: it is saved as cleared (absent), never as
   []. A quote needs its words and who said them — the website's own rule
   (apps/web content/validate.js). */

export interface StoryQuote {
  text: string;
  attribution: string;
}

export const QUOTES_MAX = 6;
export const QUOTE_TEXT_MAX = 600;
export const ATTRIBUTION_MAX = 160;
export const IMPACT_MAX = 12;
export const IMPACT_LINE_MAX = 200;

/* What the editor stores for a list: the items, or nothing at all. */
export const listOrNone = <T>(items: T[]): T[] | undefined => (items.length ? items : undefined);

/* What would be refused, per quote (by index) and per field. */
export function quoteProblems(quotes: readonly StoryQuote[]): Map<number, { text?: string; attribution?: string }> {
  const problems = new Map<number, { text?: string; attribution?: string }>();
  const seen = new Set<string>();
  quotes.forEach((q, i) => {
    const found: { text?: string; attribution?: string } = {};
    const words = q.text.trim();
    if (!words) found.text = "Add the words, as said.";
    else if (seen.has(words)) found.text = "The same words as an earlier quote.";
    if (!q.attribution?.trim()) found.attribution = "Name who said it.";
    seen.add(words);
    if (found.text || found.attribution) problems.set(i, found);
  });
  return problems;
}

/* What would be refused, per impact line (by index). */
export function impactProblems(lines: readonly string[]): Map<number, string> {
  const problems = new Map<number, string>();
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    const words = line.trim();
    if (!words) problems.set(i, "Write the line, or remove it.");
    else if (seen.has(words)) problems.set(i, "The same as an earlier line.");
    seen.add(words);
  });
  return problems;
}
