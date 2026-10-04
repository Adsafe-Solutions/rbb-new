/* Two scans of a build's output — Document 24 §18–19, as Document 27
   redraws them.

   `productionGate` is the SAFETY gate. scripts/prerender.mjs runs it on
   every build and the build FAILS on anything it finds: a credential, a
   file that must never be published, a development-catalogue route. None
   of these is ever acceptable, in any environment, so failing the build
   is the right response.

   `contentReadiness` answers a different question: has the FINAL
   production content replaced the working placeholders? Working
   placeholder wording, reserved contact values and stock photographs are
   NORMAL working content — that is what makes `npm run dev` and
   `npm run build` show the whole site — so this scan never fails a
   build. scripts/release-status.mjs reads it and holds
   PRODUCTION-CONTENT-READY until it comes back empty.

   Both inspect the output itself — every HTML, JS, CSS, XML and text file
   in dist/, every file name, and robots.txt — so they catch a leak
   however it got there (a missed import, a copied string, a stray file),
   not only the ways we have thought of.

   Messages give the file and the rule, never the matched text of a
   secret. */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
/* The patterns are shared with the content validator. */
import { CREDENTIALS, WORKING_MARKERS, PLACEHOLDER_CONTACT, workingContentFindings } from "../src/lib/releaseMarkers.js";

export { CREDENTIALS, WORKING_MARKERS, PLACEHOLDER_CONTACT };

/* The development catalogue (/design-system, /components — Document 20)
   and test fixtures: strings that exist only there. */
const DEV_AND_TEST = [
  ["development catalogue content", /FeaturedWork · placeholder slots|Bands, frames, highlights, icons, accents/],
  ["test fixture", /not-real|FAKEKEY|rzp_test_SCRATCH/],
];

/* Files that must never be published, whatever the content is. */
const FORBIDDEN_FILES = [
  ["email preview", /email-previews|\.eml$/],
  ["environment file", /(^|\/)\.env/],
  ["source map", /\.map$/],
  ["server code", /(^|\/)server\//],
];

const TEXT = /\.(html|js|css|xml|txt|json|svg|webmanifest)$/;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/* "name@example.com" is the email field's FORMAT hint (a reserved
   example, GOV.UK style) — not a contact value, so it is never a finding
   in either scan. */
const readText = async (file) => (await readFile(file, "utf8")).replaceAll("name@example.com", "");

/* SAFETY. Every problem in `dist`, as { file, rule }. Empty = clean, and
   anything else fails the build. */
export async function productionGate(dist, { routes = [] } = {}) {
  const problems = [];
  const files = await walk(dist);
  for (const file of files) {
    const rel = relative(dist, file);
    for (const [rule, re] of FORBIDDEN_FILES) if (re.test(rel)) problems.push({ file: rel, rule });
    if (!TEXT.test(file)) continue;
    const text = await readText(file);
    for (const [rule, re] of [...CREDENTIALS, ...DEV_AND_TEST])
      if (re.test(text)) problems.push({ file: rel, rule });
  }

  /* The development routes are never part of a deployable build. */
  for (const route of routes)
    if (/^\/(design-system|components)(\/|$)/.test(route))
      problems.push({ file: route, rule: "development route" });

  return problems;
}

/* INDEXING. A page that would be INDEXED while it still shows working
   placeholder content, as { route, rules, approvals }. Empty = safe.

   Working content is allowed in every build — it is how the site is
   reviewed (Document 27) — but never on a page that says `index`. That
   can only happen once an approval area has been marked approved in
   release/approvals.mjs while its content still carries placeholders,
   and on a build with a production domain it is a hard failure: the page
   would be published to search engines as RBB's. `pages` are the rendered
   pages: { route, robots, approvalAreas, html }. */
export function indexingProblems(pages) {
  return pages
    .filter((page) => /^index\b/.test(page.robots ?? ""))
    .map((page) => ({
      route: page.route,
      rules: workingContentFindings(page.html),
      approvals: page.approvalAreas ?? [],
    }))
    .filter((problem) => problem.rules.length > 0);
}

/* The marker table ITSELF ships in the browser bundle (content/seo.js
   and content/stories.js use it to tell working content from final), as
   entries like ["demo address",/100 Demo Street|Demo City|Demo Country/].
   Scanned as text, every entry matches its own pattern — so the scan
   could never come back empty, and the release could never be READY,
   however much real content RBB supplied. Each whole entry, name and
   pattern together, is removed before scanning; nothing else is, so a
   placeholder in actual content is still found. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const MARKER_TABLE_ENTRIES = [...WORKING_MARKERS, ...PLACEHOLDER_CONTACT].map(
  ([name, re]) => new RegExp(`\\[\\s*["'\`]${escapeRe(name)}["'\`]\\s*,\\s*/${escapeRe(re.source)}/[a-z]*\\s*\\]`, "g")
);
export const withoutMarkerTable = (text) => MARKER_TABLE_ENTRIES.reduce((t, entry) => t.replace(entry, ""), text);

/* READINESS. Where working placeholder content is still on show, as
   { file, rule }. Empty means the final production content is in — it
   does NOT mean the content is approved; release/approvals.mjs answers
   that. Never fails a build. */
export async function contentReadiness(dist, { routes = [] } = {}) {
  const findings = [];
  const files = await walk(dist);
  for (const file of files) {
    const rel = relative(dist, file);
    /* Stock photographs still carry their working names. */
    if (/(^|\/)demo-[\w-]+\.(jpg|jpeg|png|webp|pdf)$/.test(rel))
      findings.push({ file: rel, rule: "working placeholder photograph" });
    if (!TEXT.test(file)) continue;
    const text = withoutMarkerTable(await readText(file));
    for (const [rule, re] of [...WORKING_MARKERS, ...PLACEHOLDER_CONTACT])
      if (re.test(text)) findings.push({ file: rel, rule });
  }

  /* Working placeholder team profiles have their own addresses. */
  for (const route of routes)
    if (/^\/about\/team\/[\w-]+-demo$/.test(route))
      findings.push({ file: route, rule: "working placeholder team profile" });

  return findings;
}
