import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isFocalPoint } from "@rbb/content-schema";
import { overridesFrom } from "../snapshot-adapter.mjs";
import { cardFocal, focalPosition } from "../../src/lib/focal.js";
import { settingsRecord } from "../../../api/test/fixtures/settings.ts";
import { FACTS, mediaHarness, member } from "../../../api/test/media/memory.ts";
import { harness, sharedData } from "../../../api/test/settings/memory.ts";
import { createApproved } from "../../../api/test/support/workflow.ts";

/* Milestone 2 — an image's focal point and caption, end to end: saved in
   the media library (the API's own media service), published (the API's
   own publish service, in memory), adapted (scripts/snapshot-adapter.mjs)
   and rendered by the site's real routes through Vite's SSR loader, as the
   pre-render renders them. No database, no storage, no network. */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, render, Picture;

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
  ({ default: Picture } = await vite.ssrLoadModule("/src/components/Picture/Picture.jsx"));
});
after(async () => {
  await vite?.close();
});

test("the website's focal-point rule is the contract's, case for case", () => {
  for (const value of ["50% 50%", "0% 0%", "100% 100%", "0% 100%", "72% 45%", "101% 0%", "0% 101%", "-1% 5%", "50.5% 40%", "50%  40%", "50% 40", "center", "", " 50% 40%", "1000% 1%", null, undefined, 50])
    assert.equal(Boolean(focalPosition(value)), isFocalPoint(value), String(value));
});

test("Picture: a valid focal point is object-position; none or an invalid one changes nothing", () => {
  const html = (props) => renderToStaticMarkup(h(Picture, { src: "https://media.test/a.png", alt: "A", className: "h-full w-full object-cover", ...props }));
  assert.match(html({ focal: "20% 80%" }), /style="object-position:20% 80%"/);
  for (const focal of [undefined, null, "", "150% 0%", "left top"]) assert.doesNotMatch(html({ focal }), /style=/, String(focal));
  assert.match(html({ focal: "0% 100%", style: { opacity: 0.5 } }), /style="opacity:0.5;object-position:0% 100%"/, "merged with a style already given");
  assert.match(html({ style: { opacity: 0.5 } }), /style="opacity:0.5"/, "no focal: the style as given");
});

test("cards use a focal point set in the media library — the website's own photographs keep today's crop", () => {
  assert.equal(cardFocal({ src: "/a.jpg", focal: "50% 40%" }), undefined, "a source photograph");
  assert.equal(cardFocal({ src: "https://media.test/a.png", focal: "50% 40%", mediaId: "m1" }), "50% 40%", "a CMS image");
  assert.equal(cardFocal(undefined), undefined);
});

test("the adapter carries a valid focal point and a caption — never an invalid one, never an empty one", () => {
  const snap = {
    version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
    settings: { id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published", general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." }, contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {} },
    media: {
      a: { id: "a", url: "https://media.test/a.png", mimeType: "image/png", alt: "A", focal: "20% 80%", caption: "  A caption  " },
      b: { id: "b", url: "https://media.test/b.png", mimeType: "image/png", alt: "B", focal: "150% 0%", caption: "   " },
      c: { id: "c", url: "https://media.test/c.png", mimeType: "image/png", alt: "C" },
    },
    content: { news: ["a", "b", "c"].map((id, i) => ({ id: `n${i}`, type: "news", slug: `n${i}`, title: `N${i}`, body: [], imageId: id, status: "published", publishedAt: "2026-10-01T00:00:00Z" })) },
  };
  const news = overridesFrom(snap)["src/content/media.js"].NEWS;
  const image = (slug) => news.find((n) => n.id === slug).image;
  assert.deepEqual([image("n0").focal, image("n0").caption], ["20% 80%", "A caption"]);
  assert.ok(!("focal" in image("n1")) && !("caption" in image("n1")), "invalid focal and blank caption dropped");
  assert.deepEqual(image("n2"), { src: "https://media.test/c.png", alt: "C", mediaId: "c" }, "an image without either: as before");
});

test("round trip: a focal point and caption saved in the media library reach the rendered website", async () => {
  /* 1. The CMS: media library edit, a story using it, a publish — the API's services, in memory. */
  const data = sharedData();
  const cms = harness("rbb", data);
  const owner = member("rbb", "OWNER");
  await cms.settings.importInitial(settingsRecord("rbb"), { id: null, name: "Settings import" });
  const library = mediaHarness("rbb", { rows: data.media, data: data.base });
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const upload = async (filename) => {
    const intent = await library.service.createUploadIntent(owner, { filename, mimeType: "image/png", size: png.byteLength }, FACTS);
    library.storage.put(intent.objectKey, png, "image/png");
    return library.service.complete(owner, intent.mediaId, FACTS);
  };
  const framed = await upload("framed.png");
  await library.service.updateMetadata(owner, framed.id, { version: framed.version, alt: "Volunteers sorting boxes", focal: "20% 80%", caption: "Volunteers at the test centre" }, FACTS);
  const gallery = await upload("gallery.png");
  await library.service.updateMetadata(owner, gallery.id, { version: gallery.version, alt: "A gallery photograph", focal: "100% 0%", caption: "The second test photograph" }, FACTS);
  const plain = await upload("plain.png");
  await library.service.updateMetadata(owner, plain.id, { version: plain.version, alt: "A plain photograph" }, FACTS);
  const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
  await createApproved(cms.stories, owner, { title: "A framed test story", slug: "a-framed-test-story", category: "field", body, imageId: framed.id, galleryIds: [gallery.id] }, FACTS);
  await createApproved(cms.stories, owner, { title: "A plain test story", slug: "a-plain-test-story", category: "field", body, imageId: plain.id }, FACTS);
  await cms.publishing.publish(owner, FACTS);
  const snapshot = await cms.publishing.publicSnapshot();
  assert.deepEqual([snapshot.media[framed.id].focal, snapshot.media[framed.id].caption], ["20% 80%", "Volunteers at the test centre"], "in the snapshot");

  /* 2. The website: the adapter's overrides on the site's own modules, then the real routes. */
  for (const [file, exports] of Object.entries(overridesFrom(snapshot))) {
    const mod = await vite.ssrLoadModule(`/${file}`);
    for (const [name, value] of Object.entries(exports)) {
      /* A nested target ("ANNOUNCEMENTS.bar") is a path into the export. */
      const target = name.split(".").reduce((node, key) => node?.[key], mod);
      if (Array.isArray(target)) target.splice(0, target.length, ...value);
      else if (target && typeof target === "object" && value && typeof value === "object") Object.assign(target, value);
    }
  }
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
  const page = render("/stories/a-framed-test-story").html;
  const imgOf = (html, src) => new RegExp(`<img[^>]*src="${src.replace(/[.?]/g, "\\$&")}"[^>]*>`).exec(html)?.[0] ?? "";
  assert.match(imgOf(page, snapshot.media[framed.id].url), /style="object-position:20% 80%"/, "the story image keeps its focal point in frame");
  assert.match(page, /<figcaption[^>]*>Volunteers at the test centre<\/figcaption>/, "its caption is shown");
  assert.match(imgOf(page, snapshot.media[gallery.id].url), /style="object-position:100% 0%"/, "a gallery image, at the boundary");
  assert.match(page, /<figcaption[^>]*>The second test photograph<\/figcaption>/);
  const hub = render("/stories").html;
  assert.match(imgOf(hub, snapshot.media[framed.id].url), /style="object-position:20% 80%"/, "the story card uses the library's focal point");
  const plainPage = render("/stories/a-plain-test-story").html;
  assert.doesNotMatch(imgOf(plainPage, snapshot.media[plain.id].url), /object-position/, "no focal point: centred, as before");
  assert.doesNotMatch(plainPage.slice(plainPage.indexOf("<main")), /<figcaption[^>]*>(?!—)/, "no caption: none shown");
});
