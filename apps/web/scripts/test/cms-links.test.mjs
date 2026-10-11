import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { overridesFrom } from "../snapshot-adapter.mjs";

/* Milestone 1 — links the CMS supplies. The content contract lets a link's
   href be a site path, an https:// URL, a mailto: or tel: address, or a
   #fragment (packages/content-schema common/link.ts); the adapter hands it
   to the pages as `to` (linkOf), and the pages draw it with <Button to> or
   react-router's <Link to>. Rendered here exactly as the pre-render renders
   it: published records → the adapter's overrides → the site's own content
   modules → the real routes.

   In the browser, react-router 7 treats a `to` on another origin as
   external — mailto: and tel: included (their origin is "null") — and
   leaves the click to the browser (react-router's Link: `isExternal`);
   a same-origin path is navigated in the app. This test proves the markup
   both rely on: the destination is the href, unchanged. */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, render;
const modules = {};

const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const LINKS = {
  external: { label: "Give with our partner", href: "https://partner.test/give?campaign=spring" },
  email: { label: "Email the team", href: "mailto:team@partner.test?subject=Hello" },
  phone: { label: "Call the office", href: "tel:+441234567890" },
  anchor: { label: "See how we report", href: "#transparency" },
  internal: { label: "Our work", href: "/work" },
};
const block = (id, type, data) => ({ id, type, enabled: true, version: 1, data });
const snapshot = {
  version: 9,
  schemaVersion: 1,
  generatedAt: "2026-10-07T10:00:00.000Z",
  organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." },
    contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {},
  },
  media: {},
  content: {
    about: {
      id: "about", orgId: "rbb", schemaVersion: 1, status: "published",
      sections: [
        block("intro", "pageHero", { title: "About a test organization", body: "A test line.", cta: LINKS.internal }),
        block("how-we-work", "approach", { heading: "How the work happens", body: "A test line.", cta: LINKS.anchor }),
        block("transparency", "transparency", {}),
        block("closing", "cta", { heading: "Join in", primary: LINKS.external, secondary: LINKS.email }),
      ],
    },
    team: [
      {
        id: "t1", orgId: "rbb", schemaVersion: 1, status: "published", slug: "test-person", name: "Test Person", role: "A test role", group: "team", order: 0,
        shortBio: "A test line.", biography: ["A test paragraph."],
        relatedLinks: [LINKS.external, LINKS.email, LINKS.phone, LINKS.internal],
      },
    ],
  },
};

before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always: the published-snapshot plugin reads
     build-meta/published-snapshot.json when Vite loads its config — a file
     published-snapshot.test.mjs writes and removes while other test files
     run in parallel. RBB_SNAPSHOT=off is the plugin's own switch for "no
     snapshot". (ws: false — no WebSocket server, so parallel loaders never
     race for its port.) */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  /* The adapter's overrides, applied to the site's own modules as the build appends them. */
  for (const [file, exports] of Object.entries(overridesFrom(snapshot))) {
    const mod = (modules[file] = await vite.ssrLoadModule(`/${file}`));
    for (const [name, value] of Object.entries(exports)) {
      if (Array.isArray(mod[name])) mod[name].splice(0, mod[name].length, ...value);
      else Object.assign(mod[name], value);
    }
  }
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

/* Every <a> in the page: its href, attributes and visible text. */
const anchors = (html) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
    href: /\bhref="([^"]*)"/.exec(attrs)?.[1]?.replaceAll("&amp;", "&"),
    target: /\btarget="([^"]*)"/.exec(attrs)?.[1],
    rel: /\brel="([^"]*)"/.exec(attrs)?.[1],
    text: inner.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").trim(),
  }));
const find = (links, label) => links.find((a) => a.text.includes(label));

test("CMS page links render with their label and their exact destination — external, email, anchor and internal", () => {
  assert.ok(modules["src/content/about.js"].PUBLISHED_ABOUT.page, "the published About page is in place");
  const links = anchors(render("/about").html);
  assert.equal(find(links, LINKS.external.label)?.href, LINKS.external.href, "https:// kept as is, query included");
  assert.equal(find(links, LINKS.email.label)?.href, LINKS.email.href, "mailto: kept as is");
  assert.equal(find(links, LINKS.internal.label)?.href, "/work", "a site path stays a site path");
  assert.equal(find(links, LINKS.anchor.label)?.href, "/about#transparency", "a fragment is this page's anchor");
});

test("links drawn with react-router's Link directly (team profile related links) keep their destinations too", () => {
  const links = anchors(render("/about/team/test-person").html);
  assert.equal(find(links, LINKS.external.label)?.href, LINKS.external.href);
  assert.equal(find(links, LINKS.email.label)?.href, LINKS.email.href);
  assert.equal(find(links, LINKS.phone.label)?.href, LINKS.phone.href);
  assert.equal(find(links, LINKS.internal.label)?.href, "/work");
});

test("no CMS link opens a new window without rel=noopener — the same window, as the site's own links", () => {
  for (const route of ["/about", "/about/team/test-person"])
    for (const a of anchors(render(route).html)) if (a.target === "_blank") assert.match(a.rel ?? "", /noopener/, `${route}: ${a.href}`);
  const external = find(anchors(render("/about").html), LINKS.external.label);
  assert.equal(external.target, undefined, "opens in the same window");
});

test("a CMS link never becomes a relative path by accident — no destination is rewritten under the current page", () => {
  for (const route of ["/about", "/about/team/test-person"])
    for (const a of anchors(render(route).html))
      if (/partner\.test|^mailto:|^tel:/.test(a.href ?? "")) assert.match(a.href, /^(https:\/\/|mailto:|tel:)/, `${route}: ${a.href}`);
});
