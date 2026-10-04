/* The final release gate's checks — `npm run release:check`.

   ONE question: is THIS build, with THIS production environment, safe and
   ready to deploy publicly? READY or BLOCKED, never "probably".

   Pure functions over a context the CLI assembles (scripts/release-check.mjs)
   — the build artifact (dist/ + build-meta/), the server environment, the
   RBB approval record and the release evidence — so every check can be
   tested against a deliberately broken input (scripts/test/
   release-check.test.mjs).

   Nothing here is a second source of truth. It reads:
     release/approvals.mjs        APPROVALS (RBB's decisions), EVIDENCE (tests run)
     lib/release-state.mjs        the release state and its content checks
     src/lib/releaseMarkers.js    what counts as working placeholder content
     production-gate.mjs          the safety gate and the indexing gate
     server/config.mjs, server/donations/config.mjs, server/rate-limit.mjs
                                  the fail-closed environment loaders
   and FAILS CLOSED: anything it cannot confirm is a blocker.

   ⚠ Never prints or returns a secret. Environment values are tested, never
   echoed; findings name variables, not their contents. */
import { indexingProblems } from "../production-gate.mjs";
import { releaseState } from "./release-state.mjs";
import { formAvailable, loadConfig as loadEmailConfig } from "../../server/config.mjs";
import { loadDonationConfig } from "../../server/donations/config.mjs";
import { rateLimitProblem } from "../../server/rate-limit.mjs";

export const CATEGORIES = [
  "APPROVAL",
  "CONTENT",
  "SEO",
  "ROUTES",
  "LEGAL",
  "CONTACT",
  "IMAGES",
  "FORMS",
  "EMAIL",
  "DONATIONS",
  "SECURITY",
  "INFRASTRUCTURE",
  "ACCESSIBILITY",
  "PERFORMANCE",
];

/* Which open decisions in docs/RBB_CONTENT_DECISION_REGISTER.md each
   approval area settles — so a blocker points at the exact decision. */
const DECISIONS = {
  coreIdentity: "D8, D9, D10, D34",
  impact: "D1–D4",
  financials: "D5–D7",
  programs: "D11–D13",
  team: "D16",
  geography: "D14",
  stories: "D15",
  contact: "D17–D19",
  forms: "D20, D21",
  donation: "D25–D31, D35",
  email: "D22, D30",
  policies: "D23, D24, D29",
  images: "D32, D33",
  infrastructure: "D36",
};

const DEV_ROUTE = /^\/(design-system|components)(\/|$)/;
const PREVIEW_DESCRIPTION = /^Preview content —/;
/* Hosts that are never a real recipient or sender. */
const RESERVED_DOMAIN = /@([\w-]+\.)*(example\.(com|org|net)|test|invalid|localhost|local)>?$/i;

const fileForRoute = (route) => (route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`);

/* ---------------- The checks ---------------- */

export function evaluateRelease(ctx) {
  const results = [];
  const pass = (category, what) => results.push({ category, status: "pass", what });
  const block = (category, what, why, need, extra = {}) =>
    results.push({ category, status: "blocked", what, why, need, ...extra });
  const warn = (category, what, why) => results.push({ category, status: "warning", what, why });

  const { approvals, evidence, meta, dist, env, tests = {}, smoke = null } = ctx;
  const { readiness, contentReadiness, revision, routes = [], redirects = [], seoRoutes = [], securityHeaders } = meta;
  const approved = (k) => approvals[k]?.status === "approved";
  const passed = (k) => evidence[k]?.status === "passed";
  const html = (route) => dist.text.get(fileForRoute(route)) ?? null;

  /* The production origin as this build published it — read back from
     robots.txt, never configured or guessed here. */
  const robotsTxt = dist.text.get("robots.txt") ?? "";
  const origin = /^Sitemap:\s*(https:\/\/[^/\s]+)\/sitemap\.xml\s*$/m.exec(robotsTxt)?.[1] ?? null;

  /* ---------------- INFRASTRUCTURE: the build itself ---------------- */
  if (!readiness || !revision) {
    block("INFRASTRUCTURE", "No production build to assess", "build-meta/ is missing or incomplete", "Run the gate without --skip-build, or `npm run build` first");
    return finish(results, ctx);
  }
  for (const [name, label] of [
    ["build", "Build and prerender"],
    ["validate", "Content validation"],
    ["release", "Release tests"],
    ["server", "Server tests"],
  ]) {
    if (tests[name] === "pass") pass("INFRASTRUCTURE", `${label} passed`);
    else if (tests[name] === "skipped")
      block("INFRASTRUCTURE", `${label} not run in this check`, "--skip-build was used, so this artifact was not verified end to end", "Run `npm run release:check` without --skip-build");
    else block("INFRASTRUCTURE", `${label} failed`, "see the output above", "Fix the failure and run the gate again");
  }
  if (!revision.gitCommit)
    block(
      "INFRASTRUCTURE",
      "Build is not from a git commit",
      "the artifact cannot be traced to a commit, so it cannot be the approved release candidate",
      "Build the release from a clean, committed checkout"
    );
  else if (revision.uncommittedSourceChanges)
    block(
      "INFRASTRUCTURE",
      "Built from uncommitted source changes",
      "the artifact cannot be traced to a commit, so it cannot be the approved release candidate",
      "Build the release from a clean, committed checkout"
    );
  else pass("INFRASTRUCTURE", `Built from commit ${revision.gitCommit}`);

  /* ---------------- APPROVAL: every RBB approval area ---------------- */
  for (const [area, record] of Object.entries(approvals)) {
    if (approved(area)) {
      pass("APPROVAL", `${area} approved (${record.by ?? "?"}, ${record.date ?? "?"})`);
      continue;
    }
    const affected = seoRoutes.filter((r) => r.approvalAreas.includes(area)).map((r) => r.route);
    block(
      "APPROVAL",
      `${area} — ${record.what}`,
      `recorded as "${record.status}" in release/approvals.mjs`,
      `RBB's decision (${DECISIONS[area] ?? "see the register"} in docs/RBB_CONTENT_DECISION_REGISTER.md), then the approval recorded with status, by, date and ref`,
      { affected }
    );
  }

  /* ---------------- CONTENT ---------------- */
  if (!contentReadiness) block("CONTENT", "No placeholder scan", "build-meta/content-readiness.json is missing", "Rebuild");
  else if (contentReadiness.placeholders > 0)
    block(
      "CONTENT",
      `${contentReadiness.placeholders} working placeholder occurrence(s) in ${contentReadiness.files.length} file(s)`,
      `the build still shows working content: ${contentReadiness.rules.join(", ")}`,
      "Replace every placeholder with RBB's approved content (docs/FINAL_CONTENT_REPLACEMENT_CHECKLIST.md)",
      { files: contentReadiness.files.slice(0, 25) }
    );
  else pass("CONTENT", "No working placeholder content in the build");

  /* The record-level content checks of the release state (one
     calculation, shared with `npm run release:status`). */
  const state = releaseState({ approvals, evidence, readiness, contentReadiness, revision });
  for (const line of Object.values(state.allBlockers).flat())
    if (/content not ready/.test(line))
      block("CONTENT", line.replace(/^(approved but )?content not ready — /, ""), "the content does not yet support the approval", "Supply and approve the content");

  /* ---------------- SEO ---------------- */
  const indexable = seoRoutes.filter((r) => /^index\b/.test(r.robots));
  if (!readiness.siteOrigin || !origin) {
    block(
      "SEO",
      "PRODUCTION DOMAIN NOT CONFIGURED",
      "VITE_SITE_URL is not a verified production origin, so there are no canonicals, no sitemap and no absolute URLs",
      "Set VITE_SITE_URL to RBB's approved production domain (decision D36) and rebuild"
    );
  } else {
    pass("SEO", `Production domain ${origin}`);
    if (!indexable.length)
      block("SEO", "No page is indexable", "every page is noindex — the approvals its content depends on are pending", "Complete the approvals; pages become indexable on their own");
    for (const r of indexable) {
      const expected = `${origin}${r.route === "/" ? "/" : r.route}`;
      const canonicalOk = r.canonical === expected || (r.route === "/" && r.canonical === origin);
      if (!canonicalOk) block("SEO", `${r.route}: canonical is ${r.canonical ?? "missing"}`, "an indexable page must name itself on the production domain", `Canonical ${expected}`);
      if (!r.description || PREVIEW_DESCRIPTION.test(r.description))
        block("SEO", `${r.route}: no final description`, "an indexable page has a missing or preview description", "Approved content for the page");
      if (r.route !== "/" && !r.title) block("SEO", `${r.route}: no title`, "an indexable page needs its own title", "Approved content for the page");
    }
    /* sitemap.xml must list EXACTLY the indexable pages. */
    const sitemap = dist.text.get("sitemap.xml");
    if (!sitemap) block("SEO", "sitemap.xml missing", "a production-domain build must publish one", "Rebuild with VITE_SITE_URL set");
    else {
      const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
      const wanted = new Set(indexable.map((r) => r.canonical));
      for (const loc of locs)
        if (!wanted.has(loc))
          block("SEO", `sitemap.xml lists ${loc}`, "it is not an indexable page of this build (noindex, preview content or unknown)", "Only indexable pages may be in the sitemap — check content/seo.js `sitemapRoutes`");
      for (const loc of wanted) if (!locs.has(loc)) block("SEO", `sitemap.xml omits ${loc}`, "an indexable page is missing from the sitemap", "Rebuild; check content/seo.js `sitemapRoutes`");
      if ([...locs].every((l) => wanted.has(l)) && [...wanted].every((l) => locs.has(l)))
        pass("SEO", `sitemap.xml lists exactly the ${wanted.size} indexable page(s)`);
    }
  }
  for (const r of seoRoutes.filter((x) => !/^index\b/.test(x.robots) && x.canonical))
    block("SEO", `${r.route}: canonical on a noindex page`, "a canonical and noindex contradict each other", "Check content/seo.js `build`");
  if (/^Disallow:\s*\/\s*$/m.test(robotsTxt))
    block("SEO", "robots.txt disallows the whole site", "per-page robots then cannot be read", "robots.txt must allow crawling; keep pages out with noindex");
  else pass("SEO", "robots.txt allows crawling; per-page robots decide indexing");
  const leaking = indexingProblems(indexable.map((r) => ({ ...r, html: html(r.route) ?? "" })));
  for (const p of leaking)
    block("SEO", `${p.route} is indexable but shows working content`, p.rules.join(", "), `Replace the content, or leave ${p.approvals.join(", ") || "its approval"} pending`);
  /* A public page whose approvals are all granted but which is still
     noindex: probably intended (e.g. Careers with no openings), but worth
     a look. Not a blocker. */
  for (const r of seoRoutes)
    if (!/^index\b/.test(r.robots) && r.approvalAreas.length && r.approvalAreas.every(approved))
      warn("SEO", `${r.route} is noindex although ${r.approvalAreas.join(", ")} approved`, "its content rule keeps it out of the index (e.g. nothing to list yet)");

  /* ---------------- ROUTES ---------------- */
  const routeSet = new Set(routes);
  const redirectSources = new Set(redirects.map((r) => r.from));
  let routesOk = true;
  for (const route of routes) {
    if (DEV_ROUTE.test(route)) {
      routesOk = false;
      block("ROUTES", `Development route ${route} is a page`, "the design-system and component catalogue must never ship", "Build without the dev-tool switches (config/sections.js)");
    }
    if (!dist.text.has(fileForRoute(route))) {
      routesOk = false;
      block("ROUTES", `${route} has no page in dist/`, "a listed route was not written", "Rebuild");
    }
  }
  for (const file of dist.files) {
    if (/^(design-system|components)\//.test(file)) {
      routesOk = false;
      block("ROUTES", `Development page dist/${file}`, "the catalogue must never ship", "Build without the dev-tool switches");
    }
    if (!file.endsWith("index.html")) continue;
    const route = file === "index.html" ? "/" : `/${file.replace(/\/index\.html$/, "")}`;
    if (!routeSet.has(route) && !redirectSources.has(route)) {
      routesOk = false;
      block("ROUTES", `Unexpected page ${route}`, "dist/ contains a page that is neither a route nor a redirect", "Remove it, or add it to the sitemap (content/nav.js)");
    }
  }
  for (const { from, to } of redirects) {
    const target = to.split("#")[0] || "/";
    if (routeSet.has(from)) {
      routesOk = false;
      block("ROUTES", `${from} is both a page and a redirect`, "the host would serve one and hide the other", "Remove one of them (config/routes.js, content/nav.js)");
    }
    if (redirectSources.has(target)) {
      routesOk = false;
      block("ROUTES", `Redirect chain or loop: ${from} → ${to}`, "a redirect target is itself redirected", "Point the redirect at the final page (config/routes.js)");
    } else if (!routeSet.has(target)) {
      routesOk = false;
      block("ROUTES", `Redirect ${from} → ${to} has no target page`, "the target is not a route of this build", "Fix the target (config/routes.js, content/nav.js)");
    }
    const stub = dist.text.get(fileForRoute(from));
    if (!stub || !stub.includes(`url=${to}`)) {
      routesOk = false;
      block("ROUTES", `Redirect ${from} has no forwarding page to ${to}`, "the static fallback for the redirect is missing or points elsewhere", "Rebuild");
    }
  }
  const notFound = dist.text.get("404.html");
  if (!notFound || !/name="robots" content="noindex/.test(notFound)) {
    routesOk = false;
    block("ROUTES", "404.html missing or indexable", "unknown addresses must get a real, noindex not-found page", "Rebuild");
  }
  if (routesOk) pass("ROUTES", `${routes.length} routes, ${redirects.length} redirects, 404 — consistent; no development routes`);

  /* ---------------- LEGAL ---------------- */
  for (const id of ["privacy", "terms"])
    if (readiness.policiesFinal?.includes(id)) pass("LEGAL", `${id} policy is final`);
    else
      block("LEGAL", `${id === "privacy" ? "Privacy policy" : "Terms of use"} is not final`, "the page shows the pending line or working text", "Policy text written or approved by RBB / legal counsel (decision D23) in content/policies.js");
  const donationsLive = readiness.donation?.state === "approved-live";
  if (donationsLive && !readiness.policiesFinal?.some((p) => /refund|donation/.test(p)))
    block("LEGAL", "No donation / refund policy", "online donations are live but no refund or donation terms are published", "Donation and refund terms from RBB / legal counsel (decision D24)");

  /* ---------------- CONTACT ---------------- */
  const contactRules = (contentReadiness?.rules ?? []).filter((r) => /example|555|address/.test(r));
  if (!readiness.contactMethods) block("CONTACT", "No verified contact method", "content/contact.js has none", "RBB's contact details (decision D17)");
  if (contactRules.length)
    block("CONTACT", "Placeholder contact details are published", contactRules.join(", "), "RBB's real email, phone (or none) and address (or none) (decision D17)");
  for (const s of readiness.socials ?? [])
    if (s.homepageOnly) block("CONTACT", `${s.platform} link is the platform's home page`, "it is not an RBB account", "RBB's account URL, or remove the platform (decision D18)");
  if (readiness.contactMethods && !contactRules.length && !(readiness.socials ?? []).some((s) => s.homepageOnly))
    pass("CONTACT", "Contact details and social links are final");

  /* ---------------- IMAGES ---------------- */
  const imageFiles = dist.files.filter((f) => /^assets\/.+\.(jpe?g|png|webp|gif|avif)$/i.test(f));
  /* One entry per SOURCE image: "demo-team-1-800-AbCd1234.webp" and
     "demo-team-1-AbCd1234.jpg" are both demo-team-1. */
  const stem = (f) =>
    f
      .split("/")
      .pop()
      .replace(/-[\w-]{8}\.\w+$/, "")
      .replace(/-\d{3,4}$/, "");
  const photos = [...new Set(imageFiles.map(stem))].sort();
  const demo = photos.filter((f) => /^demo-/.test(f));
  if (demo.length)
    block("IMAGES", `${demo.length} temporary image(s) published`, "working placeholder photographs (Pexels stand-ins) are in the build", "An RBB-approved photograph in place of each (decision D32)", { files: demo });
  if (!approved("images"))
    block("IMAGES", `Ownership and licence of ${photos.length} published image(s) not approved`, "release/approvals.mjs `images` is pending", "RBB confirms ownership, licence and consent for each (docs/IMAGE_INVENTORY.md, decisions D32/D33)", { files: photos });
  let imagesOk = !demo.length;
  for (const route of routes) {
    const page = html(route) ?? "";
    for (const m of page.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
      if (!/\salt="/.test(tag)) {
        imagesOk = false;
        block("IMAGES", `${route}: image without alt text (${src ?? "?"})`, "every image needs alt text, or alt=\"\" when decorative", "Add alt text in the content record");
      }
      if (src && src.startsWith("/") && !dist.files.includes(src.slice(1))) {
        imagesOk = false;
        block("IMAGES", `${route}: ${src} does not resolve`, "the image is not in the build", "Fix the image reference");
      }
    }
  }
  if (imagesOk) pass("IMAGES", `${photos.length} published image(s) resolve and carry alt text`);

  /* ---------------- FORMS & EMAIL ---------------- */
  const email = loadEmailConfig(env);
  const forms = readiness.forms ?? {};
  const enabledForms = Object.entries(forms).filter(([, s]) => s === "ready").map(([id]) => id);
  for (const [id, s] of Object.entries(forms)) {
    if (s === "ready") {
      if (!formAvailable(email, id))
        block("FORMS", `${id} form is enabled but has no working destination`, `email mode is "${email.mode}" or EMAIL_TO_${id.toUpperCase()} is not set`, "Configure Resend (live) and the form's recipient on the host");
      if (!readiness.policiesFinal?.includes("privacy"))
        block("FORMS", `${id} form links a privacy policy that is not final`, "the form collects personal data", "Final Privacy policy (decision D23)");
    } else if (!approved("forms"))
      block("FORMS", `${id} form is ${s}`, "no approved launch decision says it may be off", "RBB approves the forms set (decision D21) — enabled with a destination, or disabled on purpose");
    else pass("FORMS", `${id} form ${s} by approved decision`);
  }
  if (enabledForms.length) {
    if (!email.allowedOrigin || email.allowedOrigin !== origin)
      block("FORMS", "ALLOWED_ORIGIN does not match the production domain", "the form endpoint would refuse, or accept, the wrong origin", "ALLOWED_ORIGIN = the production origin");
    const limit = rateLimitProblem({ live: email.mode === "live", store: email.rateLimit.store, singleInstance: email.rateLimit.singleInstance, provided: false });
    if (limit) block("FORMS", "Rate limiting is not production-safe", limit, "Configure RATE_LIMIT_STORE / RATE_LIMIT_SINGLE_INSTANCE for the host");
    else pass("FORMS", "Rate limiting configured; validation and anti-spam are server-side (server/handler.mjs)");
  }

  const donation = loadDonationConfig(env);
  const emailNeeded = enabledForms.length > 0 || (donationsLive && donation.email.enabled);
  if (!emailNeeded) pass("EMAIL", "No email is needed by this build's enabled features");
  else {
    if (email.mode !== "live")
      block("EMAIL", `EMAIL_MODE is "${email.mode}"`, email.problems.length ? `configuration problems: ${email.problems.join("; ")}` : "production must send for real", "EMAIL_MODE=live with a verified sender (decision D30)");
    else pass("EMAIL", "Resend in live mode");
    if (env.EMAIL_TEST_RECIPIENT)
      block("EMAIL", "EMAIL_TEST_RECIPIENT is set", "a test recipient must not remain in production", "Remove it from the production environment");
    const addresses = [["EMAIL_FROM", email.from], ...Object.entries(email.recipients).map(([id, to]) => [`EMAIL_TO_${id.toUpperCase()}`, to])];
    if (donationsLive && donation.email.enabled) addresses.push(["EMAIL_TO_DONATIONS", donation.email.notifyTo]);
    for (const [name, value] of addresses)
      if (value && RESERVED_DOMAIN.test(value))
        block("EMAIL", `${name} uses a reserved test domain`, "mail to or from it cannot be delivered", `A real, verified address for ${name}`);
    if (!passed("resendStagingDelivery"))
      block("EMAIL", "Real delivery through the verified Resend domain not tested", evidence.resendStagingDelivery?.what ?? "", "Run the staging delivery test and record it in EVIDENCE");
  }

  /* ---------------- DONATIONS ---------------- */
  /* The checkout's no-payment PREVIEW (content/donation.js
     `donationPreview`): placeholder amounts in a placeholder currency, on
     a form that takes nothing. Right for reviewing the page, never for
     production — whatever the launch decision. Read from the build's
     readiness facts AND from the page itself, so neither can hide it. */
  const previewOnPage = /data-donation-preview/.test(html("/get-involved/donate") ?? "");
  if (readiness.donation?.preview || previewOnPage)
    block(
      "DONATIONS",
      "The donation form PREVIEW is on the donation page",
      "a no-payment form with placeholder amounts and currency must never be published",
      "Open donations (approved-live, verified Razorpay) — or, to launch without online donations, remove `checkout.preview` from content/donation.js (decision D31)"
    );
  if (!donationsLive) {
    if (approved("donation"))
      pass("DONATIONS", "DONATIONS DISABLED BY APPROVED LAUNCH DECISION");
    else
      block(
        "DONATIONS",
        "No approved launch decision on online donations",
        "the donation page is not live, and release/approvals.mjs `donation` is pending",
        "RBB decides: launch with Razorpay (configured and verified) or without online donations (decision D31)"
      );
  } else {
    if (donation.mode !== "live")
      block(
        "DONATIONS",
        `Donations are live on the page but Razorpay is "${donation.mode}"`,
        donation.problems.length ? `configuration problems: ${donation.problems.join("; ")}` : "production needs RAZORPAY_MODE=live with a live key",
        "Live Razorpay credentials and webhook secret on the host (never in the repo)"
      );
    else pass("DONATIONS", `Razorpay live, ${donation.currency}`);
    if (donation.mode === "live" && !donation.presets.length && !donation.custom)
      block("DONATIONS", "No approved donation amounts", "neither presets nor a custom amount are configured", "Approved amounts (decision D27)");
    if (donation.allowedOrigin && origin && donation.allowedOrigin !== origin)
      block("DONATIONS", "ALLOWED_ORIGIN does not match the production domain", "the donation endpoint checks the Origin", "ALLOWED_ORIGIN = the production origin");
    if (!securityHeaders?.donationCheckout)
      block("DONATIONS", "The build's CSP does not allow Razorpay Checkout", "the donation page would be blocked by its own policy", "Rebuild with VITE_DONATIONS_API set");
    for (const k of ["razorpayTestE2E", "razorpayWebhookTest", "razorpayCspReverified"])
      if (!passed(k)) block("DONATIONS", `Not verified: ${evidence[k]?.what ?? k}`, "release evidence missing", `Run it and record EVIDENCE.${k}`);
  }

  /* ---------------- SECURITY ---------------- */
  for (const p of ctx.safetyProblems ?? [])
    block("SECURITY", `${p.rule}: ${p.file}`, "the safety gate refuses this in any build", "Remove it from the build");
  if (!(ctx.safetyProblems ?? []).length) pass("SECURITY", "Safety gate: no credentials, forbidden files, source maps or development routes in dist/");
  const headers = securityHeaders?.headers?.["/*"] ?? {};
  const csp = headers["Content-Security-Policy"] ?? "";
  if (securityHeaders?.mode !== "enforce") block("SECURITY", `CSP mode is ${securityHeaders?.mode ?? "unknown"}`, "production must enforce, not report", "Build without RBB_CSP=report-only");
  if (!csp) block("SECURITY", "No Content-Security-Policy", "build-meta/security-headers.json has none", "Rebuild");
  if (/'unsafe-eval'/.test(JSON.stringify(securityHeaders?.headers ?? {})))
    block("SECURITY", "CSP allows 'unsafe-eval'", "never permitted", "Remove it (scripts/security-policy.mjs)");
  for (const directive of csp.split(";").map((d) => d.trim()))
    if (/'unsafe-inline'/.test(directive) && !/^style-src-attr\b/.test(directive))
      block("SECURITY", `CSP allows 'unsafe-inline' in ${directive.split(" ")[0]}`, "only style attributes may be inline", "Hash the inline code instead (scripts/security-policy.mjs)");
  for (const name of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options", "Cross-Origin-Opener-Policy"])
    if (!headers[name]) block("SECURITY", `Header ${name} missing`, "required on every response", "Rebuild; check scripts/security-policy.mjs");
  if (!securityHeaders?.headers?.productionHttpsOnly?.["Strict-Transport-Security"])
    block("SECURITY", "No HSTS header for HTTPS", "production is HTTPS-only", "Rebuild; check scripts/security-policy.mjs");
  if (csp && securityHeaders?.mode === "enforce" && !/'unsafe-eval'/.test(csp))
    pass("SECURITY", "CSP enforced; no 'unsafe-eval'; security headers and HSTS present");
  if (donation.mode === "test" && donationsLive)
    block("SECURITY", "Razorpay TEST credentials in the production environment", "test and live must never be mixed", "Live credentials only on production");

  /* ---------------- INFRASTRUCTURE: release evidence ---------------- */
  for (const k of ["liveCredentialsConfigured", "hostHeadersVerified", "previewSmoke", "hostTechnologyAudit", "productionSmoke", "finalQa"])
    if (!passed(k)) block("INFRASTRUCTURE", `Not done: ${evidence[k]?.what ?? k}`, "no passing record in release/approvals.mjs EVIDENCE", `Run it on the real host and record EVIDENCE.${k} (status, date, ref)`);
  const freeze = evidence.contentFreeze;
  if (freeze?.status !== "frozen") block("INFRASTRUCTURE", "Content freeze not recorded", "the approved release candidate is not identified", "Record EVIDENCE.contentFreeze with this build's contentRevision");
  else if (freeze.contentRevision !== revision.contentRevision)
    block("INFRASTRUCTURE", `Content changed after the freeze (frozen ${freeze.contentRevision}, built ${revision.contentRevision})`, "this is not the approved candidate", "Re-run validation and QA, then re-freeze");
  if (!smoke)
    block("INFRASTRUCTURE", "Deployment not smoke-tested by this check", "no --url was given", "npm run release:check -- --url=https://<preview or production>");
  else if (smoke.ok) pass("INFRASTRUCTURE", `Browser smoke passed on ${smoke.url}`);
  else block("INFRASTRUCTURE", `Browser smoke failed on ${smoke.url}`, smoke.summary, "Fix the failures shown above");

  /* ---------------- ACCESSIBILITY ---------------- */
  let a11yOk = true;
  for (const route of routes) {
    const page = html(route) ?? "";
    const h1 = (page.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) {
      a11yOk = false;
      block("ACCESSIBILITY", `${route} has ${h1} <h1> elements`, "each page needs exactly one", "Fix the page structure");
    }
    if (!/<html[^>]*\slang="/.test(page)) {
      a11yOk = false;
      block("ACCESSIBILITY", `${route} has no lang attribute`, "screen readers need the page language", "Fix index.html");
    }
    if (!/href="#main"/.test(page)) {
      a11yOk = false;
      block("ACCESSIBILITY", `${route} has no skip link`, "keyboard users need to bypass the navigation", "Restore the skip link (components/Header)");
    }
  }
  if (a11yOk) pass("ACCESSIBILITY", "Every page: one <h1>, a lang attribute, a skip link; images checked under IMAGES");
  if (!passed("finalQa"))
    block("ACCESSIBILITY", "Full accessibility QA not recorded", "automated audit, keyboard flows, focus, reduced motion and overflow are part of EVIDENCE.finalQa", "Run the QA matrix on the release candidate and record it");

  /* ---------------- PERFORMANCE (report only) ---------------- */
  const perf = ctx.performance ?? {};
  pass(
    "PERFORMANCE",
    `JS ${kb(perf.js)} (${kb(perf.jsGzip)} gzip), CSS ${kb(perf.css)} (${kb(perf.cssGzip)} gzip), ${routes.length} routes, ${photos.length} images, prerender ${tests.build === "fail" ? "failed" : "ok"}`
  );

  return finish(results, ctx, state);
}

const kb = (n) => (Number.isFinite(n) ? `${(n / 1024).toFixed(1)} kB` : "?");

function finish(results, ctx, state = null) {
  const blockers = results.filter((r) => r.status === "blocked");
  return {
    result: blockers.length ? "BLOCKED" : "READY",
    blockerCount: blockers.length,
    categories: Object.fromEntries(
      CATEGORIES.map((c) => {
        const mine = results.filter((r) => r.category === c);
        return [c, mine.some((r) => r.status === "blocked") ? "BLOCKED" : mine.length ? "OK" : "NOT CHECKED"];
      })
    ),
    releaseState: state?.state ?? null,
    results,
  };
}
