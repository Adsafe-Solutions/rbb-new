/* The migration rehearsal's planner: the website's source content → a
   proposed CMS migration manifest. PURE: no files, no network, no
   database — the source bundle (source.mjs), the records that already
   exist (existing.mjs, or none) and the CMS rules (rules.mjs) go in, a
   manifest comes out, and the same inputs always give the same manifest.

   It plans; it never writes. What it decides, per record:
     create          nothing with this key exists (or existing records were
                     not checked — the manifest says so)
     exists-same     a record with this key exists and matches
     exists-differs  a record with this key exists and differs: reported,
                     never changed
     needs-decision  it carries something the CMS cannot hold without an
                     explicit policy (a release marker: sample content)
     blocked         it cannot be migrated as it stands (a missing
                     required field, an unresolved reference, missing
                     media, a contract violation, a duplicate key)

   Nothing is dropped silently: every source field is either sent, set by
   the API, or listed under `withheld` with its reason; release markers
   stay in the manifest even though the CMS refuses them. */
import { createHash } from "node:crypto";

export const MANIFEST_VERSION = 1;

/* ---------- Canonical JSON (sorted keys): hashing and comparison ---------- */
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
      : value;
export const canonicalJson = (value) => JSON.stringify(canonical(value));
export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/* ---------- Decisions the manifest can ask for ---------- */
export const DECISIONS = {
  "sample-content": "Sample/working content carries a release marker, which the CMS refuses (and the snapshot forbids). Migrating it would publish samples without the marker that keeps the release blocked. Decide: keep samples in the website's code until RBB's own content replaces them, or add a CMS sample flag first.",
  "api-gap": "The content contract has this field but the API does not accept it yet (schema/admin work).",
  "schema-gap": "The website draws this field but the content contract has no place for it (schema work).",
  "media-gap": "The media library or the published snapshot has no place for this image property.",
  "required-missing": "The API requires a field the source record does not have — supply it or change the rule.",
  "collection-replacement": "Publishing any record of this collection replaces the website's whole source list for it (team: even a draft). Migrate the collection completely, or not at all, before a publish.",
  "existing-record": "A record with this key already exists. It is reported, never overwritten — reconcile by hand in the admin.",
  "not-mapped": "This content has no converter in the rehearsal yet.",
  "excluded-by-policy": "This content must not be migrated as it stands.",
};

/* ---------- Source fields: where each one goes ---------- */
/* Per collection, every raw source key: `to` = the CMS field it becomes;
   `api` = handled by the API or the workflow (id, status, order);
   `withheld` = not migrated, with the decision it needs. A raw key that is
   NOT listed here is reported as unmapped — never dropped silently. */
const API = (why) => ({ api: why });
const TO = (field, note) => ({ to: field, ...(note && { note }) });
const WITHHELD = (decision, why) => ({ withheld: decision, why });
const MARKER = WITHHELD("sample-content", "release marker (sample content)");
export const SOURCE_FIELDS = {
  program: {
    slug: TO("slug"), title: TO("title"), icon: TO("icon"), description: TO("description"), missing: TO("missingNote"),
    why: TO("why"), activities: TO("activities"), impact: TO("impact"),
    stories: TO("stories", "plain lines naming the website's SAMPLE story titles, unmarked — they stay text after stories move to the CMS"),
    to: API("derived from the slug (/work/<slug>)"),
  },
  metric: { id: TO("slug"), value: TO("value"), label: TO("label"), status: TO("verification") },
  project: {
    id: API("the CMS assigns a new id; the slug is the stable key"), editorialStatus: API("created as a draft; approval is the owner's"),
    slug: TO("slug"), title: TO("title"), program: TO("programId"), description: TO("description"), image: TO("imageId"),
    context: TO("context"), activities: TO("activities"), approach: TO("approach"), outcomes: TO("outcomes"), featured: TO("featured"),
    releaseMarker: MARKER,
    // Milestone 6
    location: TO("location"), status: TO("stage", "the project's own stage, never its editorial status"), date: TO("date"),
    impact: TO("impact"), partners: TO("partners"), story: TO("storyId", "by the story's id when the copy is the story's own title and excerpt; any other copy is refused, never lost"),
  },
  team_member: {
    id: API("the CMS assigns a new id; the slug is the stable key"), status: API("created as a draft; approval is the owner's"),
    order: API("set by the team order (POST /api/v1/team/order)"), slug: TO("slug"), name: TO("name"), role: TO("role"), category: TO("group"),
    featured: TO("featured"), shortBio: TO("shortBio"), biography: TO("biography"), relatedLinks: TO("relatedLinks"),
    image: TO("imageId"), imageAlt: TO("media alt", "the portrait's alt text belongs to its media-library record"),
    departmentOrArea: TO("departmentOrArea"), location: TO("location"), socialLinks: TO("socialLinks"),
    releaseMarker: MARKER, approvedAt: WITHHELD("schema-gap", "approval date"),
  },
  story: {
    id: API("the CMS assigns a new id; the slug is the stable key"), status: API("created as a draft; approval is the owner's"),
    slug: TO("slug"), title: TO("title"), category: TO("category"), excerpt: TO("excerpt"), featured: TO("featured"), image: TO("imageId"),
    programId: TO("programId"), projectId: TO("projectId"), body: TO("body", "paragraphs become rich text"), media: TO("galleryIds"),
    relatedStoryIds: TO("relatedPostIds", "by slug in the source; re-pointed to the new ids when written"),
    date: TO("date"), author: TO("author"), location: TO("location"), releaseMarker: MARKER,
    quotes: TO("quotes"), impact: TO("impact"), // Milestone 5
  },
  news: {
    id: TO("slug"), status: API("created as a draft; approval is the owner's"), date: TO("date"), title: TO("title"), summary: TO("excerpt"),
    body: TO("body", "paragraphs become rich text"), image: TO("imageId"), program: TO("programId"), releaseMarker: MARKER, seo: TO("seo"),
  },
  blog: {
    id: TO("slug"), status: API("created as a draft; approval is the owner's"), date: TO("date"), category: TO("category"), title: TO("title"),
    excerpt: TO("excerpt"), image: TO("imageId"), body: TO("body", "paragraphs become rich text"), author: TO("author"), releaseMarker: MARKER, seo: TO("seo"),
  },
  event: {
    id: TO("slug"), status: API("created as a draft; approval is the owner's"), date: TO("date"), start: TO("startTime"), end: TO("endTime"),
    program: TO("programId"), title: TO("title"), subtitle: TO("subtitle"), summary: TO("summary"), about: TO("about", "paragraphs become rich text"),
    venue: TO("venue"), address: TO("address"), mapUrl: TO("mapUrl"), schedule: TO("schedule"), image: TO("imageId"),
    timezone: TO("timezone"), registrationUrl: TO("registrationUrl"), seo: TO("seo"), releaseMarker: MARKER,
  },
  report: {
    id: TO("slug"), status: API("published documents only"), title: TO("title"), year: TO("year"), type: TO("type"), fileUrl: TO("fileUrl"),
    description: WITHHELD("schema-gap", "document description"),
  },
  appeal: {
    id: API("the CMS assigns a new id; the slug is the stable key"), orgId: API("the deployment's organization"), schemaVersion: API("set by the API"),
    status: API("created as a draft; approval is the owner's"), kind: TO("kind"), slug: TO("slug"), title: TO("title"), summary: TO("summary"),
    imageId: TO("imageId"), highlight: TO("highlight"), sections: TO("sections"), donation: TO("donation"), startsOn: TO("startsOn"), endsOn: TO("endsOn"),
    seo: TO("seo"), releaseMarker: MARKER,
  },
};
/* Image properties: `src` is the file, `alt` the library record's alt
   text; `focal` and `caption` the library record's too (Milestone 2). */
const IMAGE_FIELDS = { src: TO("file"), alt: TO("alt"), focal: TO("media focal"), caption: TO("media caption") };

/* Fields of a converted record the API sets itself, never the payload. */
const ENVELOPE = new Set(["id", "orgId", "schemaVersion", "status", "order", "createdAt", "updatedAt", "publishedAt"]);
/* Fields that hold media ids (the conformance check's list). */
const MEDIA_FIELDS = new Set(["imageId", "insetId", "posterId", "ogImageId", "cardImageId", "logoId", "faviconId", "galleryIds", "imageIds"]);
/* References by key, per collection: field → the collection named. */
const REFERENCES = {
  project: { programId: "program", storyId: "story" },
  story: { programId: "program", projectId: "project", relatedPostIds: "story" },
  news: { programId: "program" },
  event: { programId: "program" },
};
/* Story, news and blog slugs share one address space (the posts store). */
const SLUG_SPACE = { story: "post", news: "post", blog: "post" };

/* Known caveats a page carries into the CMS, beyond its fields. */
const PAGE_NOTES = {
  impact: ["Its stories block names stories by id. The CMS gives migrated stories new ids, so the block is re-pointed (by slug) when stories are written — and while the website's own stories are the site's, it names theirs (docs/PUBLISHING.md \"Moving to CMS stories\")."],
  transparency: ["The website publishes accountability text as verified whatever its status (scripts/snapshot-adapter.mjs transparencyFrom); the source's is pending review."],
  about: ["The Team intro reads the SOURCE mission statement, so a CMS edit of it does not reach it. /impact/our-approach quotes the PUBLISHED About page's mission (#5)."],
};

export const COLLECTION_ORDER = ["program", "metric", "project", "team_member", "story", "news", "blog", "event", "report", "appeal"];
export const PAGE_ORDER = ["settings", "homepage", "about", "impact", "transparency", "careers", "general_donation", "announcement_bar", "popup"];

/* ---------- Helpers ---------- */
const walk = (value, visit, path = []) => {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, [...path, i]));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) {
    visit(k, v, [...path, k]);
    walk(v, visit, [...path, k]);
  }
};
const pathText = (path) => path.join(".");

/* Media ids in a record → symbolic references, with where they were. */
function mediaRefs(record) {
  const refs = [];
  walk(record, (key, value, path) => {
    if (!MEDIA_FIELDS.has(key)) return;
    if (typeof value === "string") refs.push({ path: pathText(path), key: value });
    else if (Array.isArray(value)) value.forEach((v, i) => typeof v === "string" && refs.push({ path: `${pathText(path)}.${i}`, key: v }));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) typeof v === "string" && refs.push({ path: `${pathText(path)}.${k}`, key: v });
  });
  return refs;
}
const symbolic = (record, replacements) => {
  const out = structuredClone(record);
  for (const { path, to } of replacements) {
    const parts = path.split(".");
    let node = out;
    for (const p of parts.slice(0, -1)) node = node[p];
    node[parts.at(-1)] = to;
  }
  return out;
};
/* Release markers anywhere in a record, by path. */
function markers(record) {
  const found = [];
  walk(record, (key, value, path) => key === "releaseMarker" && value !== undefined && found.push({ path: pathText(path), marker: value }));
  return found;
}
const issuesOf = (contract, record) => {
  const r = contract.safeParse(record);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "(record)"}: ${i.message}`);
};
/* Field names whose values differ (references compared by key are skipped:
   ids differ by design between the source and the CMS). */
const differingFields = (payload, existing, fields, skip) =>
  fields.filter((f) => !skip.has(f) && canonicalJson(payload[f] ?? null) !== canonicalJson(existing?.[f] ?? null));

/* ---------- The plan ---------- */
export function planMigration({ source, existing, rules }) {
  const organization = source.organization;
  const checked = Boolean(existing?.checked);
  const records = [];
  const usedMedia = new Map();
  const decisionCounts = new Map();
  const decide = (id) => decisionCounts.set(id, (decisionCounts.get(id) ?? 0) + 1);
  const useMedia = (key, by) => usedMedia.set(key, [...(usedMedia.get(key) ?? []), by]);

  /* Keys the plan can resolve a reference against: the source's own
     records (to be created) and the records that already exist. */
  const known = {};
  for (const type of COLLECTION_ORDER) {
    known[type] = new Map();
    for (const e of existing?.collections?.[type] ?? []) known[type].set(e.slug, "existing");
    for (const s of source.collections[type] ?? []) if (!known[type].has(s.slug)) known[type].set(s.slug, "source");
  }
  const storySlugById = new Map((source.collections.story ?? []).map((s) => [s.sourceId, s.slug]));

  /* Duplicate keys within a slug space. */
  const seen = new Map();
  for (const type of COLLECTION_ORDER)
    for (const s of source.collections[type] ?? []) {
      const space = `${SLUG_SPACE[type] ?? type}:${s.slug}`;
      seen.set(space, [...(seen.get(space) ?? []), `${type}:${s.slug}`]);
    }

  for (const type of COLLECTION_ORDER) {
    const rule = rules.collections[type];
    const items = source.collections[type] ?? [];
    const error = source.conversionErrors?.find((e) => e.type === type);
    if (error) {
      records.push({ key: `${type}:*`, type, action: "blocked", blockers: [`the source could not be converted: ${error.message}`] });
      continue;
    }
    if (items.length) decide("collection-replacement");
    for (const item of items) {
      const key = `${type}:${item.slug}`;
      const blockers = [];
      const withheld = [];
      const decisions = new Set();
      const notes = [];

      /* Every raw source field accounted for. */
      const map = SOURCE_FIELDS[type] ?? {};
      for (const field of Object.keys(item.raw).sort()) {
        const how = map[field];
        if (!how) {
          withheld.push({ field, reason: "not mapped by the rehearsal — decide where it belongs", decision: "schema-gap" });
          decisions.add("schema-gap");
        } else if (how.withheld && field !== "releaseMarker") {
          withheld.push({ field, reason: how.why, decision: how.withheld });
          decisions.add(how.withheld);
        } else if (how.note) notes.push(`${field}: ${how.note}`);
      }
      for (const imageField of ["image", "media", "poster"]) {
        const images = [].concat(item.raw[imageField] ?? []).filter((i) => i && typeof i === "object");
        images.forEach((image, i) => {
          for (const k of Object.keys(image).sort()) {
            const how = IMAGE_FIELDS[k];
            if (!how) withheld.push({ field: `${imageField}${images.length > 1 ? `.${i}` : ""}.${k}`, reason: "image property not mapped", decision: "media-gap" });
            else if (how.withheld) {
              withheld.push({ field: `${imageField}${images.length > 1 ? `.${i}` : ""}.${k}`, reason: how.why, decision: how.withheld });
              decisions.add(how.withheld);
            }
          }
        });
      }

      /* The converted record: what the API would take, and what it would not. */
      const record = item.record;
      const payload = {};
      for (const field of rule.editable) if (record[field] !== undefined) payload[field] = record[field];
      for (const field of Object.keys(record).sort()) {
        if (ENVELOPE.has(field) || field === "releaseMarker" || rule.editable.includes(field)) continue;
        /* The API sets this itself: fine when the source says the same. */
        if (field in (rule.defaults ?? {}) && canonicalJson(record[field]) === canonicalJson(rule.defaults[field])) continue;
        if (withheld.some((w) => w.field === field)) continue;
        withheld.push({
          field,
          reason: field in (rule.defaults ?? {}) ? `the API does not accept it yet and sets ${JSON.stringify(rule.defaults[field])} on create; the source has another value` : "the content contract has it; the API does not accept it yet",
          decision: "api-gap",
        });
        decisions.add("api-gap");
      }
      for (const field of rule.required) if (payload[field] === undefined || payload[field] === null) {
        blockers.push(`missing required field "${field}"`);
        decisions.add("required-missing");
      }
      for (const issue of issuesOf(rule.contract, record)) blockers.push(`contract: ${issue}`);

      /* References: by key, resolved against the source and existing records. */
      const replacements = [];
      const references = [];
      for (const [field, target] of Object.entries(REFERENCES[type] ?? {})) {
        const values = payload[field] === undefined || payload[field] === null ? [] : [].concat(payload[field]);
        values.forEach((value, i) => {
          const slug = target === "story" && (field === "relatedPostIds" || field === "storyId") ? (storySlugById.get(value) ?? String(value).replace(/^missing:/, "")) : value;
          const resolved = known[target].get(slug) ?? "missing";
          references.push({ field: Array.isArray(payload[field]) ? `${field}.${i}` : field, to: `@${target}:${slug}`, resolved });
          if (resolved === "missing") blockers.push(`${field} refers to ${target} "${slug}", which neither the source nor the CMS has`);
          replacements.push({ path: Array.isArray(payload[field]) ? `${field}.${i}` : field, to: `@${target}:${slug}` });
        });
      }
      for (const ref of mediaRefs(payload)) {
        const media = source.media[ref.key];
        useMedia(ref.key, key);
        references.push({ field: ref.path, to: `@media:${ref.key}`, resolved: media && !media.missing ? "source" : "missing" });
        if (!media || media.missing) blockers.push(`${ref.path} names media "${ref.key}", which is not in the media registry or has no file`);
        replacements.push({ path: ref.path, to: `@media:${ref.key}` });
      }

      const dupes = seen.get(`${SLUG_SPACE[type] ?? type}:${item.slug}`);
      if (dupes.length > 1) blockers.push(`duplicate key: ${dupes.join(", ")} share one address`);

      const releaseMarker = record.releaseMarker ?? item.raw.releaseMarker;
      if (releaseMarker !== undefined) decisions.add("sample-content");

      /* Existing records: matched by organization-scoped slug, never changed. */
      const match = (existing?.collections?.[type] ?? []).find((e) => e.slug === item.slug);
      const otherSpace = SLUG_SPACE[type]
        ? COLLECTION_ORDER.filter((t) => t !== type && SLUG_SPACE[t] === SLUG_SPACE[type]).flatMap((t) => (existing?.collections?.[t] ?? []).filter((e) => e.slug === item.slug).map(() => t))
        : [];
      if (otherSpace.length) blockers.push(`the address "${item.slug}" is already used by an existing ${otherSpace.join(", ")}`);
      let existingView;
      if (match) {
        const skip = new Set([...Object.keys(REFERENCES[type] ?? {}), ...MEDIA_FIELDS]);
        const differs = differingFields(payload, match.record, rule.editable, skip);
        existingView = { id: match.id, status: match.status, revision: match.revision, differs };
        decisions.add("existing-record");
      }

      for (const d of decisions) decide(d);
      const action = match
        ? existingView.differs.length ? "exists-differs" : "exists-same"
        : blockers.length ? "blocked" : decisions.has("sample-content") ? "needs-decision" : "create";
      records.push({
        key,
        type,
        sourceId: item.sourceId,
        action,
        ...(blockers.length && { blockers }),
        ...(decisions.size && { decisions: [...decisions].sort() }),
        ...(releaseMarker !== undefined && { releaseMarker }),
        ...(existingView && { existing: existingView }),
        ...(rule.ordered && { order: item.order }),
        ...(references.length && { references }),
        ...(withheld.length && { withheld }),
        ...(notes.length && { notes }),
        payload: symbolic(payload, replacements),
      });
    }
  }

  /* ---------- Single pages and settings ---------- */
  for (const type of PAGE_ORDER) {
    const page = source.pages[type];
    const rule = rules.pages[type];
    const key = `${type}:${page?.record?.id ?? type}`;
    if (!page) continue;
    if (page.error) {
      records.push({ key, type, action: "blocked", blockers: [`the source could not be converted: ${page.error}`] });
      continue;
    }
    const record = page.record;
    const blockers = issuesOf(rule.contract, record).map((i) => `contract: ${i}`);
    const decisions = new Set();
    const withheld = [];
    const found = [...markers(record), ...(page.extraMarkers ?? [])];
    for (const m of found) withheld.push({ field: m.path, reason: `release marker "${m.marker}" (the API refuses a page that carries one)`, decision: "sample-content" });
    if (found.length) decisions.add("sample-content");
    if (rule.drawnSections)
      (record.sections ?? []).forEach((s, i) => {
        if (rule.drawnSections.includes(s.type)) return;
        withheld.push({ field: `sections.${i}`, reason: `"${s.type}" sections are not drawn on this page; the API refuses them`, decision: "api-gap" });
        decisions.add("api-gap");
      });
    /* Pages name stories by id (the Impact page's stories block): by slug
       here, as the ids change when stories are written. */
    const storyRefs = [];
    walk(record, (k, value, path) => {
      if (k !== "storyIds" || !Array.isArray(value)) return;
      value.forEach((id, i) => {
        const slug = storySlugById.get(id) ?? String(id).replace(/^missing:/, "");
        const resolved = known.story.get(slug) ?? "missing";
        storyRefs.push({ field: `${pathText(path)}.${i}`, to: `@story:${slug}`, resolved });
        if (resolved === "missing") blockers.push(`${pathText(path)}.${i} names story "${slug}", which neither the source nor the CMS has`);
      });
    });
    const media = mediaRefs(record);
    for (const ref of media) {
      useMedia(ref.key, key);
      if (!source.media[ref.key] || source.media[ref.key].missing) blockers.push(`${ref.path} names media "${ref.key}", which is not in the media registry or has no file`);
    }
    const match = existing?.pages?.[type];
    let existingView;
    if (match) {
      /* Sections by position and type: their ids are generated by whoever
         created them, so they say nothing about the content. */
      const sectionsOf = (r) => (r?.sections ?? []).map((s) => ({ type: s.type, text: canonicalJson({ type: s.type, enabled: s.enabled, data: s.data }) }));
      const mine = sectionsOf(record);
      const theirs = sectionsOf(match.record);
      const parts = [...new Set([...Object.keys(record), ...Object.keys(match.record ?? {})])].filter((p) => !ENVELOPE.has(p) && p !== "sections" && p !== "releaseMarker" && p !== "updatedBy");
      existingView = {
        id: match.id,
        status: match.status,
        revision: match.revision,
        differs: [
          ...parts.filter((p) => canonicalJson(record[p] ?? null) !== canonicalJson(match.record?.[p] ?? null)),
          ...Array.from({ length: Math.max(mine.length, theirs.length) }, (_, i) => i)
            .filter((i) => mine[i]?.text !== theirs[i]?.text)
            .map((i) => `sections.${i} (${!theirs[i] ? `${mine[i].type}: only in the source` : !mine[i] ? `${theirs[i].type}: only in the CMS` : mine[i].type === theirs[i].type ? mine[i].type : `${mine[i].type} in the source, ${theirs[i].type} in the CMS`})`),
        ],
      };
      decisions.add("existing-record");
    }
    for (const d of decisions) decide(d);
    const action = match ? (existingView.differs.length ? "exists-differs" : "exists-same") : blockers.length ? "blocked" : decisions.has("sample-content") ? "needs-decision" : "create";
    const references = [...storyRefs, ...media.map((ref) => ({ field: ref.path, to: `@media:${ref.key}`, resolved: source.media[ref.key] && !source.media[ref.key].missing ? "source" : "missing" }))];
    records.push({
      key,
      type,
      action,
      ...(blockers.length && { blockers }),
      ...(decisions.size && { decisions: [...decisions].sort() }),
      ...(existingView && { existing: existingView }),
      ...(references.length && { references }),
      ...(withheld.length && { withheld }),
      ...(PAGE_NOTES[type] && { notes: PAGE_NOTES[type] }),
      payload: symbolic(record, [...storyRefs.map((r) => ({ path: r.field, to: r.to })), ...media.map((ref) => ({ path: ref.path, to: `@media:${ref.key}` }))]),
    });
  }

  /* ---------- Get Involved (Milestone 9): five pages, by fixed id ----------
     Converted by getInvolved.mjs. Each page is checked against its
     contract (the hub's or a path's); its withheld fields and release
     markers stay in the manifest and make it ineligible; one that already
     exists is compared and reported, never overwritten. The writer does
     not write them — this is the offline plan. */
  const giError = source.conversionErrors?.find((e) => e.type === "get_involved");
  if (giError) records.push({ key: "get_involved:*", type: "get_involved", action: "blocked", blockers: [`the source could not be converted: ${giError.message}`] });
  const giCount = new Map();
  for (const page of source.getInvolved ?? []) giCount.set(page.id, (giCount.get(page.id) ?? 0) + 1);
  for (const page of source.getInvolved ?? []) {
    const key = `get_involved:${page.id}`;
    const record = page.record;
    const contract = page.id === "hub" ? rules.getInvolved.hub : rules.getInvolved.path;
    const blockers = issuesOf(contract, record).map((i) => `contract: ${i}`);
    if (giCount.get(page.id) > 1) blockers.push(`duplicate key: ${key} appears ${giCount.get(page.id)} times in the source`);
    const withheld = [...(page.withheld ?? [])];
    const decisions = new Set(withheld.map((w) => w.decision));
    const match = existing?.getInvolved?.[page.id];
    let existingView;
    if (match) {
      const parts = [...new Set([...Object.keys(record), ...Object.keys(match.record ?? {})])].filter((p) => !ENVELOPE.has(p) && p !== "releaseMarker" && p !== "updatedBy");
      existingView = {
        id: match.id,
        status: match.status,
        revision: match.revision,
        differs: parts.flatMap((p) =>
          p === "sections"
            ? Array.from({ length: Math.max(record.sections?.length ?? 0, match.record?.sections?.length ?? 0) }, (_, i) => i)
                .filter((i) => canonicalJson(record.sections?.[i] ?? null) !== canonicalJson(match.record?.sections?.[i] ?? null))
                .map((i) => `sections.${i} (${!match.record?.sections?.[i] ? "only in the source" : !record.sections?.[i] ? "only in the CMS" : record.sections[i].id})`)
            : canonicalJson(record[p] ?? null) !== canonicalJson(match.record?.[p] ?? null) ? [p] : []
        ),
      };
      decisions.add("existing-record");
    }
    for (const d of decisions) decide(d);
    const notes = [...(page.notes ?? []), ...(page.sourceStatus ? [`Its wording is "${page.sourceStatus}" in the source; it is created as a draft — approval is the owner's.`] : [])];
    const action = match ? (existingView.differs.length ? "exists-differs" : "exists-same") : blockers.length ? "blocked" : decisions.has("sample-content") ? "needs-decision" : "create";
    records.push({
      key,
      type: "get_involved",
      action,
      ...(page.releaseMarker !== undefined && { releaseMarker: page.releaseMarker }),
      ...(blockers.length && { blockers }),
      ...(decisions.size && { decisions: [...decisions].sort() }),
      ...(existingView && { existing: existingView }),
      ...(withheld.length && { withheld }),
      ...(notes.length && { notes }),
      payload: structuredClone(record),
    });
  }

  for (const n of source.notMapped ?? []) decide(n.decision);

  /* Records the CMS has that the source does not: they stay, and they
     count — a published collection replaces the website's whole list. */
  const cmsOnly = COLLECTION_ORDER.flatMap((type) =>
    (existing?.collections?.[type] ?? [])
      .filter((e) => !(source.collections[type] ?? []).some((s) => s.slug === e.slug))
      .map((e) => ({ type, slug: e.slug, id: e.id, status: e.status }))
  );

  /* ---------- Media: one upload per registry image a planned record uses ---------- */
  const existingMedia = existing?.media ?? [];
  const media = [...usedMedia.keys()].sort().map((key) => {
    const m = source.media[key];
    const usedBy = [...new Set(usedMedia.get(key))].sort();
    if (!m || m.missing) return { key, action: "blocked", blockers: [m?.missing ?? "not in the media registry"], usedBy };
    const filename = m.file.split("/").pop();
    const match = existingMedia.filter((e) => e.originalFilename === filename && e.size === m.bytes);
    return {
      key,
      action: match.length ? "possible-existing" : "upload",
      file: m.file,
      bytes: m.bytes,
      sha256: m.sha256,
      mimeType: m.mimeType,
      alt: m.alt,
      /* Milestone 2: set on the library record when it is uploaded. */
      ...(m.focal && { focal: m.focal }),
      ...(/(^|\/)demo-/.test(m.file) && { note: "working photograph: its demo- file name is what keeps the release scan seeing it" }),
      ...(match.length && { existing: match.map((e) => e.id).sort() }),
      usedBy,
    };
  });

  /* ---------- Summary ---------- */
  const byAction = {};
  for (const r of [...records, ...media]) byAction[r.action] = (byAction[r.action] ?? 0) + 1;
  const byType = {};
  for (const r of records) {
    byType[r.type] ??= {};
    byType[r.type][r.action] = (byType[r.type][r.action] ?? 0) + 1;
  }
  const decisions = [...decisionCounts.keys()].sort().map((id) => ({ id, count: decisionCounts.get(id), description: DECISIONS[id] }));

  return {
    manifestVersion: MANIFEST_VERSION,
    mode: "dry-run",
    organization,
    existing: {
      checked,
      source: existing?.source ?? "none",
      ...(existing?.database && { database: existing.database }),
      ...(!checked && { note: "Existing records were NOT checked: every create is conditional on nothing with that key existing." }),
    },
    sourceHash: source.hash,
    summary: { records: records.length, media: media.length, cmsOnly: cmsOnly.length, byAction, byType },
    decisions,
    notMapped: source.notMapped ?? [],
    cmsOnly,
    records,
    media,
  };
}
