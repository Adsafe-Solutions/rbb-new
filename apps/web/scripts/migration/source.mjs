/* The website's source content, as the rehearsal plans it: loaded through
   Vite's SSR loader exactly as the pre-render loads it — WITHOUT the
   published snapshot (the source site, byte for byte) — and converted by
   the same importers the build's conformance check uses
   (src/contract/importers.js). Reads files; writes nothing. */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createServer } from "vite";
import { canonicalJson, sha256 } from "./plan.mjs";
import { convertGetInvolved } from "./getInvolved.mjs";
import { CTA_ROUTES } from "../snapshot-adapter.mjs";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" };

/* Content that has no converter here, or must not be migrated — listed in
   every manifest so nothing is left out silently. */
const notMapped = (c) => [
  { type: "policy", count: c.POLICIES.filter((p) => p.route).length, decision: "excluded-by-policy", reason: "The source policies are working placeholder text. RBB's own policy text is never written on its behalf (docs/PUBLISHING.md); the build refuses working text in a published policy." },
  { type: "story_strip", count: 1, decision: "not-mapped", reason: "Derived from the appeals' highlight order; plan it once the appeals are in the CMS." },
  { type: "page:/about/how-we-work", count: 1, decision: "schema-gap", reason: "No CMS model (HOW_WE_WORK stays in code)." },
  { type: "page:/impact/our-approach", count: 1, decision: "schema-gap", reason: "No CMS model (IMPACT.approach and its principles)." },
  { type: "page:/impact/where-we-work", count: 1, decision: "schema-gap", reason: "No CMS model (IMPACT.geography; never a sample)." },
];

export async function loadSource({ root = WEB } = {}) {
  /* The published-snapshot plugin serves this module in builds; here, as
     in a build without a snapshot, there is none: the source site. */
  const noSnapshot = { name: "rehearsal-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0rehearsal-no-snapshot" : null), load: (id) => (id === "\0rehearsal-no-snapshot" ? "export default null;" : null) };
  /* The source site, always: the published-snapshot plugin reads
     build-meta/published-snapshot.json when Vite loads its config — a file
     published-snapshot.test.mjs writes and removes while other test files
     run in parallel. RBB_SNAPSHOT=off is the plugin's own switch for "no
     snapshot". (ws: false — no WebSocket server, so parallel loaders never
     race for its port.) */
  process.env.RBB_SNAPSHOT = "off";
  const vite = await createServer({ root, logLevel: "error", appType: "custom", configFile: join(root, "vite.config.js"), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, plugins: [noSnapshot] });
  try {
    const content = await vite.ssrLoadModule("/src/content/index.js");
    const work = await vite.ssrLoadModule("/src/content/work.js");
    const team = await vite.ssrLoadModule("/src/content/team.js");
    const appeals = await vite.ssrLoadModule("/src/content/appeals.js");
    const announcements = await vite.ssrLoadModule("/src/content/announcements.js");
    const importers = await vite.ssrLoadModule("/src/contract/importers.js");
    const { MEDIA_LIBRARY } = await vite.ssrLoadModule("/src/contract/media.js");
    const { ORG_ID } = await vite.ssrLoadModule("/src/contract/org.js");
    return sourceBundle({ root, content, work, team, appeals, announcements, importers, MEDIA_LIBRARY, ORG_ID });
  } finally {
    await vite.close();
  }
}

export function sourceBundle({ root, content: c, work, team, appeals, announcements, importers: imp, MEDIA_LIBRARY, ORG_ID }) {
  const conversionErrors = [];
  const convert = (type, fn) => {
    try {
      return fn();
    } catch (error) {
      conversionErrors.push({ type, message: error.message });
      return [];
    }
  };
  /* Each converted record beside its raw source record (by id, or by slug
     for programs, whose id is their slug). */
  const items = (records, raws, { rawKey = "id" } = {}) => {
    const raw = new Map(raws.map((x) => [x[rawKey], x]));
    return records.map((record, order) => ({ sourceId: record.id, slug: record.slug, order, raw: raw.get(rawKey === "slug" ? record.slug : record.id) ?? {}, record }));
  };

  const posts = convert("story", () => imp.postRecords());
  const collections = {
    program: items(convert("program", () => imp.programRecords()), work.PROGRAMS, { rawKey: "slug" }),
    metric: items(convert("metric", () => imp.metricRecords()), c.IMPACT.metrics),
    project: items(convert("project", () => imp.projectRecords()), work.PROJECT_RECORDS),
    team_member: items(convert("team_member", () => imp.teamRecords()), team.TEAM_MEMBERS),
    story: items(posts.filter((p) => p.type === "story"), c.STORIES),
    news: items(posts.filter((p) => p.type === "news"), c.NEWS),
    blog: items(posts.filter((p) => p.type === "blog"), c.BLOGS),
    event: items(convert("event", () => imp.eventRecords()), c.EVENTS),
    report: items(convert("report", () => imp.reportRecords()), []),
    appeal: appeals.APPEAL_RECORDS.map((record, order) => ({ sourceId: record.id, slug: record.slug, order, raw: record, record })),
  };
  /* A post conversion error blocks all three post types. */
  for (const e of conversionErrors.filter((e) => e.type === "story")) conversionErrors.push({ type: "news", message: e.message }, { type: "blog", message: e.message });

  const page = (fn, extra = {}) => {
    try {
      return { record: fn(), ...extra };
    } catch (error) {
      return { error: error.message };
    }
  };
  const bar = announcements.ANNOUNCEMENTS.bar;
  const pages = {
    settings: page(() => imp.siteSettingsRecord()),
    homepage: page(() => imp.homepageRecord()),
    about: page(() => imp.aboutRecord()),
    impact: page(() => imp.impactRecord()),
    transparency: page(() => imp.transparencyRecord()),
    careers: page(() => imp.careersRecord()),
    general_donation: page(() => imp.generalDonationRecord()),
    /* The CMS bar is ONE record of messages (AnnouncementBar); the source
       messages keep their release markers, reported by path. */
    announcement_bar: page(
      () => ({ id: "announcement-bar", orgId: ORG_ID, schemaVersion: 1, status: "published", items: bar.items.map((i) => ({ id: i.id, text: i.text, ...(i.link && { link: { label: i.link.label, href: i.link.to ?? i.link.href } }) })) }),
      { extraMarkers: bar.items.flatMap((i, n) => (i.releaseMarker ? [{ path: `items.${n}.releaseMarker`, marker: i.releaseMarker }] : [])) }
    ),
    popup: page(() => imp.popupRecord()),
  };

  const media = {};
  for (const [key, image] of Object.entries(MEDIA_LIBRARY)) {
    const src = String(image.src ?? "");
    const file = src.startsWith("/src/") ? src.slice(1) : null;
    const path = file && join(root, file);
    if (!path || !existsSync(path)) {
      media[key] = { missing: `no file for "${src}"` };
      continue;
    }
    const bytes = readFileSync(path);
    media[key] = {
      file: `apps/web/${file}`,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mimeType: MIME[file.split(".").pop().toLowerCase()] ?? "application/octet-stream",
      alt: image.alt,
      ...(image.focal && { focal: image.focal }),
    };
  }

  /* Milestone 9: the Get Involved hub and its four paths (getInvolved.mjs). */
  const getInvolved = convert("get_involved", () => convertGetInvolved({ paths: c.GET_INVOLVED.paths, hub: c.GET_INVOLVED_PAGES.hub, ctaRoutes: CTA_ROUTES, orgId: ORG_ID }));

  const bundle = { organization: ORG_ID, collections, conversionErrors, pages, getInvolved, media, notMapped: notMapped(c) };
  return { ...bundle, hash: sha256(canonicalJson(bundle)) };
}
