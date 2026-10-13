import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowedApi, previewProblems } from "../cms-preview.mjs";
import publishedSnapshot, { PREVIEW_FILE, previewTags } from "../vite-published-snapshot.mjs";

/* M36: the local preview of approved content — only from the expected
   database and organization, only in the dev server, always marked. */

const snapshot = { version: 3, schemaVersion: 1, generatedAt: "2026-10-10T00:00:00.000Z", organization: { id: "rbb" }, settings: { general: {}, contact: {}, seo: {}, social: [] }, media: {}, content: {} };
const answer = (o = {}) => ({ preview: true, target: { organization: "rbb", database: "risingbeyondborders" }, basedOnVersion: 2, problems: [], snapshot, ...o });
const expected = { database: "risingbeyondborders", organization: "rbb" };

test("the API answer: only the expected database and organization, and only a publishable candidate", () => {
  assert.deepEqual(previewProblems(answer(), expected), []);
  assert.match(previewProblems(answer({ target: { organization: "rbb", database: "rbb_r2_smoke" } }), expected).join(" "), /"rbb_r2_smoke", not "risingbeyondborders"/, "a smoke database never feeds a preview");
  assert.match(previewProblems(answer({ target: { organization: "rbb", database: "risingbeyondborders_test" } }), expected).join(" "), /not "risingbeyondborders"/);
  assert.match(previewProblems(answer({ target: { organization: "org-b", database: "risingbeyondborders" } }), expected).join(" "), /organization "org-b"/);
  assert.match(previewProblems(answer({ problems: [{ path: "content.impact", message: "x" }], snapshot: null }), expected).join(" "), /would be refused: content.impact/);
  assert.ok(previewProblems(answer({ snapshot: { ...snapshot, organization: { id: "other" } } }), expected).length, "the snapshot itself must be this site's");
  assert.ok(previewProblems({ data: 1 }, expected).length);
});

test("the API address: https, or http on this machine; never credentials in it", () => {
  assert.ok(allowedApi("http://localhost:4000"));
  assert.ok(allowedApi("http://127.0.0.1:4000"));
  assert.ok(allowedApi("https://api.example.org"));
  assert.ok(!allowedApi("http://api.example.org"));
  assert.ok(!allowedApi("https://user:pass@api.example.org"));
});

test("the plugin: published snapshots in builds and the dev server; a preview in the dev server only, never built", () => {
  const root = mkdtempSync(join(tmpdir(), "rbb-preview-"));
  const before = process.env.RBB_PREVIEW;
  try {
    delete process.env.RBB_PREVIEW;
    const normal = publishedSnapshot({ root });
    assert.equal(normal.apply({}, { command: "build" }), true);
    assert.equal(normal.apply({}, { command: "serve" }), true, "npm run dev applies it too (2026-10-13: no built-in content to fall back on)");
    assert.equal(normal.transformIndexHtml, undefined, "no preview marks outside preview mode");
    assert.equal(normal.configureServer, undefined);

    process.env.RBB_PREVIEW = "1";
    assert.throws(() => publishedSnapshot({ root }), /no build-meta\/preview-snapshot.json/, "no preview file: refused, never silently the source site");
    mkdirSync(join(root, "build-meta"));
    writeFileSync(join(root, PREVIEW_FILE), "null");
    const preview = publishedSnapshot({ root });
    assert.equal(preview.apply({}, { command: "serve" }), true);
    assert.throws(() => preview.apply({}, { command: "build" }), /never built/);
    const tags = preview.transformIndexHtml();
    assert.ok(tags.some((t) => t.tag === "meta" && t.attrs.content === "noindex, nofollow"));
    const banner = tags.find((t) => t.attrs?.id === "rbb-local-preview");
    assert.match(banner.children, /LOCAL PREVIEW/);
    assert.match(banner.children, /Not published\. Not the live website\./);
    assert.match(banner.attrs.style, /pointer-events:none/, "the banner hides nothing");
    const headers = {};
    preview.configureServer({ middlewares: { use: (fn) => fn({}, { setHeader: (k, v) => (headers[k] = v) }, () => {}) } });
    assert.equal(headers["X-Robots-Tag"], "noindex, nofollow", "every preview response is noindex");
  } finally {
    if (before === undefined) delete process.env.RBB_PREVIEW;
    else process.env.RBB_PREVIEW = before;
  }
});

test("the banner names the live version it builds on", () => {
  assert.match(previewTags({ basedOnVersion: 2 }).find((t) => t.attrs?.id === "rbb-local-preview").children, /live version 2 \+ approved changes/);
});
