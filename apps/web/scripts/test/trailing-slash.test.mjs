import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

/* A static host serves a page's folder index.html at "/x/" as well as
   "/x" (Cloudflare Pages redirects to the slash form). Every page that
   looks itself up by its address must render the same either way — never
   the error boundary — and an unknown address must still be the 404. The
   real site, rendered through Vite's SSR loader (as the prerender does). */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, site, render;

before(async () => {
  /* The published-snapshot plugin serves this module in builds only; here,
     as in a build without a snapshot, there is none — the source site. */
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always: the published-snapshot plugin reads
     build-meta/published-snapshot.json when Vite loads its config — a file
     published-snapshot.test.mjs writes and removes while other test files
     run in parallel. RBB_SNAPSHOT=off is the plugin's own switch for "no
     snapshot". (ws: false — no WebSocket server, so parallel loaders never
     race for its port.) */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  site = await vite.ssrLoadModule("/src/content/index.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const h1 = (html) => (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();

test("withoutTrailingSlash: one trailing slash or many, never the root", async () => {
  const { withoutTrailingSlash } = await vite.ssrLoadModule("/src/lib/paths.js");
  assert.equal(withoutTrailingSlash("/work/education/"), "/work/education");
  assert.equal(withoutTrailingSlash("/work/education//"), "/work/education");
  assert.equal(withoutTrailingSlash("/work/education"), "/work/education");
  assert.equal(withoutTrailingSlash("/"), "/");
  assert.equal(withoutTrailingSlash("//"), "/");
  assert.equal(withoutTrailingSlash(""), "");
  assert.equal(withoutTrailingSlash(undefined), undefined);
});

test("the five lookups find the same record with or without the trailing slash; unknown stays unknown", () => {
  const cases = [
    ...site.PROGRAMS.map((p) => [site.programByPath, p.to]),
    ...site.APPEALS.map((a) => [site.appealByPath, site.appealPath(a)]),
    ...["/appeals/emergency", "/appeals/campaigns"].map((to) => [site.appealKindByPath, to]),
    ...site.GET_INVOLVED.paths.map((p) => [site.pathByPath, p.to]),
    ...["/privacy", "/terms", "/donation-policy"].map((to) => [site.policyByRoute, to]),
  ];
  assert.ok(cases.length >= 4 + 2 + 3, "every lookup is exercised");
  for (const [lookup, to] of cases) {
    const record = lookup(to);
    assert.ok(record, `${lookup.name}(${to}) finds its record`);
    assert.equal(lookup(`${to}/`), record, `${lookup.name}(${to}/) finds the same record`);
  }
  for (const lookup of [site.programByPath, site.appealByPath, site.appealKindByPath, site.pathByPath, site.policyByRoute]) {
    assert.equal(lookup("/no-such-page/"), undefined, `${lookup.name}: unknown is still unknown`);
    assert.equal(lookup("/"), undefined, `${lookup.name}: the root is not a record`);
  }
});

test("every affected page renders the same page with and without the trailing slash", () => {
  const routes = [
    ...site.PROGRAMS.map((p) => p.to),
    "/appeals/emergency",
    "/appeals/campaigns",
    ...site.APPEALS.map((a) => site.appealPath(a)),
    ...site.GET_INVOLVED.paths.map((p) => p.to),
    "/privacy",
    "/terms",
    "/donation-policy",
  ];
  for (const route of routes) {
    const plain = render(route);
    const slashed = render(`${route}/`);
    assert.ok(h1(plain.html), `${route} has its heading`);
    assert.doesNotMatch(plain.html, /Something went wrong/, route);
    assert.equal(h1(slashed.html), h1(plain.html), `${route}/ is the same page`);
    assert.equal(slashed.meta.title, plain.meta.title, `${route}/ keeps its title`);
  }
});

test("an unknown address is still the 404 page, with or without a trailing slash", () => {
  const missing = render("/no-such-page");
  const missingSlash = render("/no-such-page/");
  const missingProgram = render("/work/no-such-program/");
  const home = render("/");
  assert.notEqual(h1(missing.html), h1(home.html));
  assert.equal(h1(missingSlash.html), h1(missing.html));
  assert.equal(h1(missingProgram.html), h1(missing.html));
  assert.equal(missing.meta.robots, "noindex, nofollow");
});
