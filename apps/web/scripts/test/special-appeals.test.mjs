import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { AppealKind } from "@rbb/content-schema";
import { appealsFrom } from "../snapshot-adapter.mjs";
import { SAVED_SNAPSHOT, applySnapshot } from "./support/saved-snapshot.mjs";

/* Special appeals (2026-10-17, RBB's request): a third kind of appeal,
   with its own subsection of Appeals — /appeals/special, in the menu, on
   the /appeals page and as each appeal's parent — drawn from the saved
   live snapshot with one appeal made special, in memory only. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const snapshot = structuredClone(SAVED_SNAPSHOT);
const source = snapshot.content.appeals[0];
const special = { ...structuredClone(source), id: `${source.id}-special`, slug: "test-special-appeal", title: "Test special appeal", kind: "special" };
snapshot.content.appeals = [...snapshot.content.appeals, special];

let vite, render, content;
before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  await applySnapshot(vite, snapshot);
  content = await vite.ssrLoadModule("/src/content/index.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

test("the contract's kinds are the site's subsections, in the menu's order", () => {
  assert.deepEqual([...AppealKind.options], ["emergency", "campaign", "special"]);
  assert.deepEqual(content.APPEAL_KINDS.map((k) => [k.cms, k.id, k.to]), [["emergency", "emergency", "/appeals/emergency"], ["campaign", "campaigns", "/appeals/campaigns"], ["special", "special", "/appeals/special"]]);
  assert.equal(appealsFrom(snapshot).find((a) => a.id === special.slug).kind, "special", "the snapshot's special appeal is in the special subsection");
  const menu = content.NAV.find((n) => n.to === "/appeals");
  assert.deepEqual(menu.children.map((c) => c.label), ["Emergency Response", "Campaigns", "Special Appeals"]);
});

test("/appeals/special lists it; its page sits under Special Appeals and gives as an appeal", () => {
  const list = text(main(render("/appeals/special").html));
  assert.match(list, /Special Appeals/);
  assert.match(list, /Test special appeal/);

  const page = main(render(`/appeals/special/${special.slug}`).html);
  assert.match(page, /href="\/appeals\/special"/, "its parent is the subsection");
  const view = content.APPEALS.find((a) => a.id === special.slug);
  assert.equal(content.appealPath(view), `/appeals/special/${special.slug}`);
  const donation = content.appealDonation(view);
  assert.deepEqual(donation.donation, { type: "appeal", appeal: special.slug });
  assert.equal(content.appealsOfCmsKind("special").length, 1);
});

test("the /appeals page has a Special Appeals band after Emergency Response and Campaigns", () => {
  const page = text(main(render("/appeals").html));
  const at = (s) => page.indexOf(s);
  assert.ok(at("Emergency Response") > -1 && at("Emergency Response") < at("Campaigns") && at("Campaigns") < at("Special Appeals"), "in the menu's order");
});
