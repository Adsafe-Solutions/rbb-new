/* The final release gate (scripts/lib/release-checks.mjs).

   Every case starts from ONE fixture in which every check is satisfied —
   so the gate is shown to be able to say READY at all — and breaks exactly
   one thing. Each break must turn the result BLOCKED, in the right
   category, with a finding that says what. Nothing here touches the real
   build, the real approval record or the real environment. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateRelease } from "../lib/release-checks.mjs";
import { productionGate } from "../production-gate.mjs";

const ORIGIN = "https://www.rbb-release-fixture.org";
const AREAS = ["coreIdentity", "impact", "financials", "programs", "team", "geography", "stories", "contact", "forms", "donation", "email", "policies", "images", "infrastructure"];
const EVIDENCE_KEYS = ["previewQa", "resendStagingDelivery", "razorpayTestE2E", "razorpayWebhookTest", "razorpayCspReverified", "liveCredentialsConfigured", "hostHeadersVerified", "previewSmoke", "hostTechnologyAudit", "productionSmoke", "finalQa"];

const page = (title, extra = "") =>
  `<!doctype html><html lang="en"><head><meta name="robots" content="index, follow" /></head><body><a href="#main">Skip to content</a><main id="main"><h1>${title}</h1><img src="/assets/photo-AbCd1234.jpg" alt="A described photograph" />${extra}</main></body></html>`;

/* A build in which everything is final, approved and configured. */
function readyContext() {
  const approvals = Object.fromEntries(AREAS.map((a) => [a, { status: "approved", by: "RBB", date: "2026-11-01", ref: "test", what: a }]));
  const evidence = {
    ...Object.fromEntries(EVIDENCE_KEYS.map((k) => [k, { status: "passed", date: "2026-11-01", ref: "test", what: k }])),
    contentFreeze: { status: "frozen", contentRevision: "rev1", what: "freeze" },
  };
  const text = new Map([
    ["index.html", page("Rising Beyond Borders")],
    ["about/index.html", page("About Rising Beyond Borders")],
    ["about-us/index.html", '<meta name="robots" content="noindex" /><meta http-equiv="refresh" content="0; url=/about" />'],
    ["404.html", '<meta name="robots" content="noindex, nofollow" /><h1>Not found</h1>'],
    ["robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`],
    ["sitemap.xml", `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/about</loc></url></urlset>`],
  ]);
  return {
    approvals,
    evidence,
    meta: {
      readiness: {
        siteOrigin: true,
        impactFigures: [{ id: "lives", status: "verified" }],
        financialOverview: "verified",
        documents: { annualReports: 1, financial: 1, governance: "approved" },
        programsWithDetail: 4,
        team: 3,
        stories: 2,
        geography: "approved",
        contactMethods: 1,
        policiesPublished: ["privacy", "terms"],
        policiesFinal: ["privacy", "terms"],
        socials: [{ platform: "instagram", homepageOnly: false }],
        forms: { contact: "disabled" },
        donation: { state: "pending", checkoutReady: false },
      },
      contentReadiness: { placeholders: 0, rules: [], files: [] },
      revision: { contentRevision: "rev1", gitCommit: "abc1234", uncommittedSourceChanges: false },
      routes: ["/", "/about"],
      redirects: [{ from: "/about-us", to: "/about", status: 301 }],
      seoRoutes: [
        { route: "/", robots: "index, follow", canonical: `${ORIGIN}/`, title: null, description: "RBB.", approvalAreas: ["coreIdentity"] },
        { route: "/about", robots: "index, follow", canonical: `${ORIGIN}/about`, title: "About", description: "Who RBB is.", approvalAreas: ["coreIdentity"] },
      ],
      securityHeaders: {
        mode: "enforce",
        donationCheckout: false,
        headers: {
          "/*": {
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=()",
            "X-Frame-Options": "DENY",
            "Cross-Origin-Opener-Policy": "same-origin",
          },
          productionHttpsOnly: { "Strict-Transport-Security": "max-age=63072000" },
        },
      },
    },
    dist: { files: [...text.keys(), "assets/photo-AbCd1234.jpg"], text },
    env: {},
    tests: { build: "pass", validate: "pass", release: "pass", server: "pass" },
    smoke: { url: ORIGIN, ok: true, summary: "" },
    safetyProblems: [],
    performance: { js: 1, jsGzip: 1, css: 1, cssGzip: 1 },
  };
}

const blocked = (report, category, pattern) =>
  report.results.some((r) => r.status === "blocked" && r.category === category && pattern.test(`${r.what} ${r.why}`));

test("the fixture is READY — the gate can pass when everything is final", () => {
  const report = evaluateRelease(readyContext());
  const open = report.results.filter((r) => r.status === "blocked").map((r) => `${r.category}: ${r.what}`);
  assert.deepEqual(open, []);
  assert.equal(report.result, "READY");
  assert.ok(report.results.some((r) => r.what === "DONATIONS DISABLED BY APPROVED LAUNCH DECISION"));
});

test("TEST 1 — a pending approval blocks, naming the area and its pages", () => {
  const ctx = readyContext();
  ctx.approvals.stories = { status: "pending", by: null, date: null, ref: null, what: "Final stories" };
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "APPROVAL", /^stories — Final stories/));
});

test("TEST 3 — a placeholder on an otherwise approved, indexable page blocks", () => {
  const ctx = readyContext();
  ctx.meta.contentReadiness = { placeholders: 1, rules: ["demo text"], files: ["about/index.html"] };
  ctx.dist.text.set("about/index.html", page("About", "<p>Demo text — a working line</p>"));
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "CONTENT", /working placeholder/));
  assert.ok(blocked(report, "SEO", /\/about is indexable but shows working content/));
});

test("TEST 4 — no production domain blocks", () => {
  const ctx = readyContext();
  ctx.meta.readiness.siteOrigin = false;
  ctx.dist.text.set("robots.txt", "User-agent: *\nAllow: /\n");
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "SEO", /PRODUCTION DOMAIN NOT CONFIGURED/));
});

test("TEST 5 — a demo page in the sitemap blocks", () => {
  const ctx = readyContext();
  ctx.dist.text.set(
    "sitemap.xml",
    ctx.dist.text.get("sitemap.xml").replace("</urlset>", `<url><loc>${ORIGIN}/about/team/amara-demo</loc></url></urlset>`)
  );
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "SEO", /sitemap\.xml lists .*amara-demo/));
});

test("TEST 6 — a test secret in the build output blocks (the real safety gate)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rbb-release-"));
  try {
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(join(dir, "robots.txt"), "User-agent: *\nAllow: /\n");
    await writeFile(join(dir, "assets", "app.js"), 'const key = "rzp_test_ABCDEF123456";');
    const ctx = readyContext();
    ctx.safetyProblems = await productionGate(dir, { routes: ctx.meta.routes });
    const report = evaluateRelease(ctx);
    assert.equal(report.result, "BLOCKED");
    assert.ok(blocked(report, "SECURITY", /Razorpay key id/));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("TEST 7 — a broken redirect, a redirect loop and a missing forwarding page all block", () => {
  const broken = readyContext();
  broken.meta.redirects = [{ from: "/about-us", to: "/nowhere", status: 301 }];
  assert.ok(blocked(evaluateRelease(broken), "ROUTES", /has no target page/));

  const loop = readyContext();
  loop.meta.redirects = [
    { from: "/a", to: "/b", status: 301 },
    { from: "/b", to: "/a", status: 301 },
  ];
  assert.ok(blocked(evaluateRelease(loop), "ROUTES", /chain or loop/));

  const stub = readyContext();
  stub.dist.text.delete("about-us/index.html");
  assert.ok(blocked(evaluateRelease(stub), "ROUTES", /no forwarding page/));
});

test("development routes, an unexpected page and an indexable 404 block", () => {
  const ctx = readyContext();
  ctx.meta.routes = [...ctx.meta.routes, "/design-system"];
  ctx.dist.text.set("design-system/index.html", page("Design system"));
  ctx.dist.files.push("design-system/index.html");
  ctx.dist.text.set("stray/index.html", page("Stray"));
  ctx.dist.files.push("stray/index.html");
  ctx.dist.text.set("404.html", "<h1>Not found</h1>");
  const report = evaluateRelease(ctx);
  assert.ok(blocked(report, "ROUTES", /Development route \/design-system/));
  assert.ok(blocked(report, "ROUTES", /Unexpected page \/stray/));
  assert.ok(blocked(report, "ROUTES", /404\.html missing or indexable/));
});

test("donations live on the page but Razorpay not live in production: misconfigured, not 'disabled by decision'", () => {
  const ctx = readyContext();
  ctx.meta.readiness.donation = { state: "approved-live", checkoutReady: true };
  ctx.meta.readiness.policiesFinal = ["privacy", "terms", "refund"];
  ctx.meta.securityHeaders.donationCheckout = true;
  ctx.env = { DONATION_ENABLED: "true", RAZORPAY_MODE: "test" }; /* no keys at all */
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "DONATIONS", /Razorpay is "off"/));
  assert.ok(!report.results.some((r) => /DISABLED BY APPROVED LAUNCH DECISION/.test(r.what)));
});

test("the donation form preview blocks — from the readiness facts, and from the page itself", () => {
  const facts = readyContext();
  facts.meta.readiness.donation = { state: "pending", checkoutReady: false, preview: true };
  const byFacts = evaluateRelease(facts);
  assert.equal(byFacts.result, "BLOCKED");
  assert.ok(blocked(byFacts, "DONATIONS", /PREVIEW is on the donation page/));

  /* Readiness says nothing, but the published page carries the preview. */
  const page_ = readyContext();
  page_.dist.text.set("get-involved/donate/index.html", page("Donate", '<p data-donation-preview="">Demo preview</p>'));
  page_.dist.files.push("get-involved/donate/index.html");
  const byPage = evaluateRelease(page_);
  assert.equal(byPage.result, "BLOCKED");
  assert.ok(blocked(byPage, "DONATIONS", /PREVIEW is on the donation page/));
});

test("an enabled form needs live email, a real recipient and no test recipient", () => {
  const ctx = readyContext();
  ctx.meta.readiness.forms = { contact: "ready" };
  ctx.env = { EMAIL_MODE: "staging", EMAIL_TEST_RECIPIENT: "qa@rbb-release-fixture.org", EMAIL_TO_CONTACT: "inbox@example.org", ALLOWED_ORIGIN: ORIGIN };
  const report = evaluateRelease(ctx);
  assert.equal(report.result, "BLOCKED");
  assert.ok(blocked(report, "EMAIL", /EMAIL_MODE is "off"/)); /* staging without a key/From is refused by the loader */
  assert.ok(blocked(report, "EMAIL", /EMAIL_TEST_RECIPIENT is set/));
  assert.ok(blocked(report, "EMAIL", /EMAIL_TO_CONTACT uses a reserved test domain/));
  /* The report never contains a configured value. */
  assert.ok(!JSON.stringify(report).includes("qa@rbb-release-fixture.org"));
});

test("weakened security headers, uncommitted source and a missing deployment smoke all block", () => {
  const ctx = readyContext();
  ctx.meta.securityHeaders.headers["/*"]["Content-Security-Policy"] += "; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval'";
  ctx.meta.revision.uncommittedSourceChanges = true;
  ctx.smoke = null;
  const report = evaluateRelease(ctx);
  assert.ok(blocked(report, "SECURITY", /'unsafe-eval'/));
  assert.ok(blocked(report, "SECURITY", /'unsafe-inline' in script-src-elem/));
  assert.ok(blocked(report, "INFRASTRUCTURE", /uncommitted/));
  const untraced = readyContext();
  untraced.meta.revision.gitCommit = null;
  assert.ok(blocked(evaluateRelease(untraced), "INFRASTRUCTURE", /not from a git commit/));
  assert.ok(blocked(report, "INFRASTRUCTURE", /not smoke-tested/));
});

test("images: a temporary image and a missing alt text block", () => {
  const ctx = readyContext();
  ctx.dist.files.push("assets/demo-team-1-800-AbCd1234.webp");
  ctx.dist.text.set("about/index.html", page("About").replace('alt="A described photograph" ', ""));
  const report = evaluateRelease(ctx);
  assert.ok(blocked(report, "IMAGES", /1 temporary image/));
  assert.ok(blocked(report, "IMAGES", /without alt text/));
});
