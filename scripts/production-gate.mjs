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
import { CREDENTIALS, WORKING_MARKERS, PLACEHOLDER_CONTACT } from "../src/lib/releaseMarkers.js";

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
    const text = await readText(file);
    for (const [rule, re] of [...WORKING_MARKERS, ...PLACEHOLDER_CONTACT])
      if (re.test(text)) findings.push({ file: rel, rule });
  }

  /* Working placeholder team profiles have their own addresses. */
  for (const route of routes)
    if (/^\/about\/team\/[\w-]+-demo$/.test(route))
      findings.push({ file: route, rule: "working placeholder team profile" });

  return findings;
}
