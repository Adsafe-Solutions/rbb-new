/* Working-placeholder text (M20): the self-labelling the website's sample
   and working copy carries ("Demo —", "Sample story", example.org
   addresses …). A record managed in the CMS is the organization's OWN
   text, so text carrying one of these markers is refused when it is
   saved, rather than published as if it were final.

   A MIRROR of the website's rules (apps/web src/lib/releaseMarkers.js:
   WORKING_MARKERS, PLACEHOLDER_CONTACT and WORKING_PHOTOGRAPH, which
   decide what counts as working content there). It is copied, not
   imported, because the website's module ships in its bundle;
   apps/web scripts/test/working-text-parity.test.mjs fails if the two
   lists drift apart. */

export const WORKING_TEXT_RULES: readonly (readonly [string, RegExp])[] = [
  ["demo text", /Demo text —/],
  ["demo summary", /Demo summary —/],
  ["demo prefix", /(^|[\s>("])Demo(nstration)?( [A-Za-z]+)?( —|:)/m],
  ["demo answer", /Demo answer —/],
  ["working text", /WORKING text —/],
  ["demo profile", /Demo profile/],
  ["demo figure", /\bdemo figure\b/i],
  ["demo location", /demo location/i],
  ["demo country", /Demo country [A-Z]\b/],
  ["demo author", /Demo Author/],
  ["demo quotation", /\(demo quotation\)/],
  ["demo document", /\(demo document\)/],
  ["demo role", /\(demo role\)/],
  ["fictional team name", /\b(Amara|Grace|Samuel|Leila|Daniel|Hannah) Demo\b/],
  ["demo address", /100 Demo Street|Demo City|Demo Country/],
  ["sample project", /\bSample project\b/],
  ["sample story", /\bSample story\b/],
  ["sample profile", /\bSample profile\b/],
  ["sample video", /\bSample video\b/],
  ["sample event", /\bSample event\b/],
  ["example.* address or URL", /\b[\w.+-]*@?example\.(org|com|net)\b/i],
  ["fictional 555 phone number", /\+?1?[\s.-]?\(?555\)?[\s.-]?01\d\d\b/],
  ["platform home page as social link", /https?:\/\/(www\.)?(instagram|facebook|linkedin|youtube|x|twitter|tiktok)\.com\/?(?=["'\s<)]|$)/],
  ["working placeholder photograph", /(^|\/)demo-[\w-]+\.(jpg|jpeg|png|webp)/],
];

/* The rules a piece of text (or a record, read as JSON) trips, by name.
   "name@example.com" is the email field's format hint, never a finding —
   the website drops it the same way. */
export function workingTextFindings(value: unknown): string[] {
  const text = (typeof value === "string" ? value : JSON.stringify(value ?? "")).replaceAll("name@example.com", "");
  return WORKING_TEXT_RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
}
