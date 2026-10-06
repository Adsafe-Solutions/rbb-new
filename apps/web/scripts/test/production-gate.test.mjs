/* Documents 24 and 27 — two scans, two jobs. The SAFETY gate must refuse
   every leak it names and must NOT refuse ordinary working placeholder
   content; the READINESS scan must find that content, so the release
   state knows RBB's final words are not in yet. Each case builds a tiny
   dist/ in a temp folder. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionGate, contentReadiness, indexingProblems, WORKING_MARKERS, PLACEHOLDER_CONTACT } from "../production-gate.mjs";

async function dist(files) {
  const dir = await mkdtemp(join(tmpdir(), "rbb-gate-"));
  const all = { "robots.txt": "User-agent: *\nAllow: /\n", "index.html": "<p>Clean page</p>", ...files };
  for (const [name, text] of Object.entries(all)) {
    await mkdir(join(dir, name, ".."), { recursive: true });
    await writeFile(join(dir, name), text);
  }
  return dir;
}
const scan = (fn) => async (files, opts) => {
  const dir = await dist(files);
  try {
    return (await fn(dir, opts)).map((p) => p.rule);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
const rules = scan(productionGate);
const readiness = scan(contentReadiness);

test("a clean build passes", async () => {
  assert.deepEqual(await rules({ "assets/app.js": 'const hint="like name@example.com";' }), []);
});

test("working placeholder content does NOT fail the safety gate", async () => {
  /* Document 27: this is what a normal build looks like until RBB's own
     content arrives, and it must build, deploy to a preview and be
     reviewed. */
  assert.deepEqual(
    await rules({
      "page/index.html": '<p>Demo text — We work…</p><h3>Amara Demo</h3><a href="mailto:hello@example.org">',
      "assets/demo-team-1-abc123.jpg": "x",
    }),
    []
  );
});

test("working placeholder content is found by the readiness scan", async () => {
  const cases = {
    "demo text": "<p>Demo text — We work…</p>",
    "demo profile": "<p>Director · Demo profile</p>",
    "fictional team name": "<h3>Amara Demo</h3>",
    "demo country": "<li>Demo country A</li>",
    "working text": "<p>WORKING text — The staff team…</p>",
    "example.* address or URL": '<a href="mailto:hello@example.org">',
    "fictional 555 phone number": "<p>+1 555 0100</p>",
  };
  for (const [rule, html] of Object.entries(cases))
    assert.ok((await readiness({ "page/index.html": html })).includes(rule), rule);

  assert.ok(
    (await readiness({ "assets/demo-team-1-abc123.jpg": "x" })).includes("working placeholder photograph")
  );
  assert.ok(
    (await readiness({}, { routes: ["/about/team/amara-demo"] })).includes("working placeholder team profile")
  );
  /* The email field's format hint is never a finding. */
  assert.deepEqual(await readiness({ "assets/app.js": 'const hint="like name@example.com";' }), []);
});

test("the marker table shipped in the bundle is not a finding — real placeholders still are", async () => {
  /* As the minifier writes it: [["demo text",/Demo text —/],…]. */
  const table = `const M=[${[...WORKING_MARKERS, ...PLACEHOLDER_CONTACT]
    .map(([name, re]) => `["${name}",${re}]`)
    .join(",")}];`;
  assert.deepEqual(await readiness({ "assets/app.js": table }), []);
  const found = await readiness({ "assets/app.js": `${table}const p="Demo text — x",c="Demo country A";` });
  assert.ok(found.includes("demo text") && found.includes("demo country"), found.join(", "));
});

test("credentials and test identifiers are refused", async () => {
  const cases = {
    "Razorpay key id": 'key:"rzp_test_ABCDEF123456"',
    "Resend API key": 'k="re_AbCdEfGh12_IjKlMnOp34"',
    "secret variable name": "RAZORPAY_KEY_SECRET",
    "private key": "-----BEGIN RSA PRIVATE KEY-----",
  };
  for (const [rule, js] of Object.entries(cases))
    assert.ok((await rules({ "assets/a.js": js })).includes(rule), rule);
});

test("forbidden files are refused", async () => {
  const got = await rules({
    "email-previews/001.html": "x",
    ".env.local": "x",
    "assets/index.js.map": "x",
  });
  for (const rule of ["email preview", "environment file", "source map"])
    assert.ok(got.includes(rule), rule);
});

test("development catalogue content, dev routes and test fixtures are refused", async () => {
  assert.ok((await rules({ "assets/a.js": '"FeaturedWork · placeholder slots"' })).includes("development catalogue content"));
  assert.ok((await rules({ "assets/a.js": 'secret="test-key-secret-not-real"' })).includes("test fixture"));
  assert.ok((await rules({}, { routes: ["/design-system"] })).includes("development route"));
});

test("indexing gate: an INDEXED page showing working content fails, naming route, rule and approval", () => {
  const problems = indexingProblems([
    { route: "/stories/x", robots: "index, follow", approvalAreas: ["stories"], html: "<p>Demo text — a story</p>" },
  ]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].route, "/stories/x");
  assert.ok(problems[0].rules.includes("demo text"));
  assert.deepEqual(problems[0].approvals, ["stories"]);
});

test("indexing gate: preview (noindex) pages may show working content", () => {
  assert.deepEqual(
    indexingProblems([
      { route: "/privacy", robots: "noindex, follow", approvalAreas: ["policies"], html: "<p>Demo text — not a policy</p>" },
      { route: "/about/team/amara-demo", robots: "noindex, follow", html: "<p>Amara Demo</p>" },
    ]),
    []
  );
});

test("indexing gate: an indexed page with final content passes; contact placeholders and demo photos are caught", () => {
  assert.deepEqual(indexingProblems([{ route: "/", robots: "index, follow", html: "<p>Final words.</p>" }]), []);
  const [p] = indexingProblems([
    { route: "/", robots: "index, follow", html: '<a href="mailto:hello@example.org">x</a><img src="/assets/demo-edu-x.jpg">' },
  ]);
  assert.ok(p.rules.includes("example.* address or URL"));
  assert.ok(p.rules.includes("working placeholder photograph"));
});
