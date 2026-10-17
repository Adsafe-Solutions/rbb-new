import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { SAVED_SNAPSHOT, applySnapshot } from "./support/saved-snapshot.mjs";

/* A kind of appeal with nothing open is not shown (2026-10-17, RBB's
   request): not in the Appeals menu, not a band on /appeals — but its own
   page stays, pre-rendered and unlisted, saying nothing is open, so a
   saved link never 404s. With no appeal open at all, Appeals is a plain
   menu link. The saved snapshot has an emergency appeal and a campaign,
   and no special appeal. */

const root = fileURLToPath(new URL("../..", import.meta.url));

async function site(snapshot) {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  process.env.RBB_SNAPSHOT = "off";
  const vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  try {
    await applySnapshot(vite, snapshot);
    const content = await vite.ssrLoadModule("/src/content/index.js");
    const server = await vite.ssrLoadModule("/src/entry-server.jsx");
    return { vite, content, server };
  } catch (error) {
    // A server left open keeps the test process alive: close it, then fail.
    await vite.close();
    throw error;
  }
}
const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

test("a kind with no appeal: off the menu and /appeals, its page still there", async (t) => {
  const { vite, content, server } = await site(structuredClone(SAVED_SNAPSHOT));
  t.after(() => vite.close());
  assert.ok(!SAVED_SNAPSHOT.content.appeals.some((a) => a.kind === "special"), "the saved snapshot has no special appeal");

  const menu = content.NAV.find((n) => n.to === "/appeals");
  assert.deepEqual(menu.children.map((c) => c.label), ["Emergency Response", "Campaigns"]);

  const hub = text(main(server.render("/appeals").html));
  assert.match(hub, /Emergency Response/);
  assert.doesNotMatch(hub, /Special Appeals/);

  assert.ok(server.prerenderPaths().includes("/appeals/special"), "still pre-rendered: a saved link lands on a page");
  const page = text(main(server.render("/appeals/special").html));
  assert.match(page, /There is no special appeal open right now/);
});

test("no appeal open at all: Appeals is a plain menu link, its kinds' pages still there", async (t) => {
  const snapshot = structuredClone(SAVED_SNAPSHOT);
  snapshot.content.appeals = [];
  delete snapshot.content.storyStrip; // its Highlights name appeals that are gone
  const { vite, content, server } = await site(snapshot);
  t.after(() => vite.close());
  const menu = content.NAV.find((n) => n.to === "/appeals");
  assert.equal(menu.children, undefined);
  for (const to of ["/appeals/emergency", "/appeals/campaigns", "/appeals/special"]) assert.ok(server.prerenderPaths().includes(to), to);
});
