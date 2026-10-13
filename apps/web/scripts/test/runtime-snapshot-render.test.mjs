import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import publishedSnapshot from "../vite-published-snapshot.mjs";
import { overridesFrom } from "../snapshot-adapter.mjs";

/* The runtime snapshot on the REAL site, through Vite's SSR loader: a
   runtime build's content modules end with the hook
   (vite-published-snapshot.mjs appendRuntimeHook), which applies the
   chosen snapshot's values BEFORE the module's dependents load — so what
   the site derives from the content as it loads (the document title from
   BRAND, the footer's socials from ORG_CONTACT, the stories' routes) all
   follow, exactly as they follow a build's baked assignments. Here the
   snapshot is chosen by setting the boot state directly, as the browser's
   loader would have (src/lib/runtimeBoot.js); no network. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const RUNTIME = { url: "https://api.example.org/api/v1/public/snapshot", origin: "https://api.example.org", version: 4, orgId: "rbb", timeoutMs: 3000, mediaOrigins: [] };
const noSnapshot = { name: "test-no-snapshot", enforce: "pre", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
const body = [{ type: "paragraph", children: [{ type: "text", text: "A paragraph published after the build." }] }];
const SNAPSHOT = {
  version: 5,
  schemaVersion: 1,
  generatedAt: "2026-10-12T10:00:00.000Z",
  organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders Runtime", summary: "A summary published after the build." },
    contact: { methods: [] },
    social: [{ platform: "linkedin", url: "https://www.linkedin.com/company/runtime-test" }],
    seo: { description: "A description published after the build." },
    branding: {}, analytics: {}, engagement: { storyStrip: { enabled: true } }, features: {},
  },
  media: {},
  content: {
    stories: [{ id: "st-runtime", orgId: "rbb", schemaVersion: 1, type: "story", status: "published", slug: "published-after-the-build", title: "A story published after the build", category: "field", body, date: "2026-10-12", publishedAt: "2026-10-12T09:00:00.000Z" }],
  },
};

const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const loader = async () => {
  process.env.RBB_SNAPSHOT = "off";
  return createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot, publishedSnapshot({ root, runtime: RUNTIME, applyInServe: true })] });
};

let vite, state, site, render;
before(async () => {
  vite = await loader();
  /* As runtimeBoot.js would have, before any content module loads. */
  ({ snapshotState: state } = await vite.ssrLoadModule("/src/lib/runtimeBoot.js"));
  state().overrides = overridesFrom(SNAPSHOT);
  state().version = 5;
  state().source = "network";
  state().status = "newer";
  site = await vite.ssrLoadModule("/src/content/index.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

test("the hook ran in every target module the snapshot sets, and nothing failed", () => {
  const s = state();
  assert.equal(s.failed, null);
  for (const file of Object.keys(s.overrides)) assert.ok(s.applied.includes(file), `${file} applied`);
  assert.ok(s.applied.includes("src/content/brand.js") && s.applied.includes("src/content/stories.js"));
});

test("what the site derives from the content AS IT LOADS follows the runtime snapshot: the document title, the footer's socials, the CMS as the stories' source", () => {
  assert.equal(site.BRAND.fullName, "Rising Beyond Borders Runtime");
  assert.equal(site.SITE.name, "Rising Beyond Borders Runtime", "SITE.name is computed from BRAND when site.js loads");
  assert.equal(site.SITE.description, "A description published after the build.");
  assert.deepEqual(site.SOCIALS.map((s) => s.icon), ["linkedin"], "SOCIALS is computed from ORG_CONTACT when footer.js loads");
  assert.equal(site.STORY_SOURCE.cms, true);
  assert.deepEqual(site.STORIES.map((s) => s.slug), ["published-after-the-build"], "the CMS's stories are the only stories");
});

test("a page published after the build renders at its address, with the snapshot's wording in the title and footer", () => {
  const story = render("/stories/published-after-the-build");
  assert.doesNotMatch(story.html, /Something went wrong/);
  assert.match(text(story.html), /A story published after the build/);
  assert.match(text(story.html), /A paragraph published after the build/);
  assert.match(story.meta.title, /A story published after the build/);
  assert.doesNotMatch(/<h1[^>]*>[\s\S]*?<\/h1>/.exec(story.html)[0], /data-release-marker=/, "the story itself carries no sample marker (other sample content on the page may)");
  const home = render("/");
  assert.match(home.head, /Rising Beyond Borders Runtime/, "the title carries the published name");
  assert.match(home.html, /linkedin\.com\/company\/runtime-test/, "the footer's social link");
  assert.match(render("/stories/not-published").html, /We cannot find that page/, "an unknown slug is still not found — the pre-render never shows the unavailable state");
});

test("highlights: storyAppeals() follows APPEAL_STORIES.order when a published strip sets it, and the site's own rule otherwise", () => {
  /* Two appeals marked for the strip, and one not (2026-10-13: the
     website has no built-in appeals). */
  const saved = [...site.APPEALS];
  const appeal = (id, story) => ({ id, kind: "emergency", title: `Appeal ${id}`, summary: "S.", sections: [], ...(story && { story: {} }) });
  site.APPEALS.splice(0, site.APPEALS.length, appeal("a1", true), appeal("a2", true), appeal("a3", false));
  try {
    const own = site.storyAppeals().map((a) => a.id);
    assert.deepEqual(own, ["a1", "a2"], "the site's own rule: the marked appeals, in list order");
    const reversed = [...own].reverse();
    site.APPEAL_STORIES.order = [reversed[0], "not-an-appeal", "a3", ...reversed.slice(1)];
    try {
      assert.deepEqual(site.storyAppeals().map((a) => a.id), reversed, "the strip's order, its appeals only, never a missing one");
    } finally {
      site.APPEAL_STORIES.order = null;
    }
    assert.deepEqual(site.storyAppeals().map((a) => a.id), own);
  } finally {
    site.APPEALS.splice(0, site.APPEALS.length, ...saved);
  }
});

test("a snapshot a module cannot take is recorded, never thrown — the module still loads, and the boot sees the failure", async () => {
  const another = await loader();
  try {
    const { snapshotState } = await another.ssrLoadModule("/src/lib/runtimeBoot.js");
    snapshotState().overrides = { "src/content/brand.js": { NOT_AN_EXPORT: { a: 1 } }, "src/content/site.js": { SITE: { description: "Still applied" } } };
    const { BRAND } = await another.ssrLoadModule("/src/content/brand.js");
    const { SITE } = await another.ssrLoadModule("/src/content/site.js");
    assert.equal(BRAND.name, "", "untouched: the module's own value (empty — the CMS sets it)");
    assert.equal(SITE.description, "Still applied");
    assert.match(snapshotState().failed.message, /brand\.js no longer declares "export const NOT_AN_EXPORT"/);
    assert.deepEqual(snapshotState().applied, ["src/content/site.js"]);
  } finally {
    await another.close();
  }
});
