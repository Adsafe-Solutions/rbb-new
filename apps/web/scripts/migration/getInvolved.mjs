/* Milestone 9 — the Get Involved converter: the website's source Get
   Involved content (src/content/getInvolved.js) → the five CMS records the
   contract already defines (packages/content-schema getInvolved:
   GetInvolvedHub, GetInvolvedPath). PURE and deterministic: content in,
   records out — no files, no network, no database, no clock.

   It is the inverse of what the website does with a published record
   (scripts/snapshot-adapter.mjs getInvolvedFrom), so a record converted
   here and published draws the page the website draws today, word for
   word. What the CMS holds is only the words RBB writes for each page;
   what a path IS stays the website's (its title, button label, route,
   icon, images, form, `featured`, the questions panel and the shared
   closing) — reported as notes, never as lost fields.

     a path   shortDescription  ← path.shortDescription
              hubNote           ← GET_INVOLVED_PAGES.hub.choose.notes[id]
              sections          ← path.sections with content, in order
                                  (body → paragraphs; items as they are)
              faq               ← the section with question/answer rows
              seo.description   ← path.metaDescription
     the hub  heading, intro    ← hub.heading, hub.body
              ways, choose      ← their kicker and heading
              closing           ← its heading and calls to action, each
                                  route named by its TARGET (CTA_TARGETS)
              why               left out: the website's "Why get involved"
                                  is the About page's mission statement,
                                  not Get Involved's own words — absent,
                                  the page keeps it, and it stays one
                                  statement in one place

   Release markers (sample content) are never stripped: one anywhere in a
   page's source is withheld as "sample-content", and the page carries its
   `releaseMarker`, so the writer never takes it.

   Nothing is dropped silently. A section the CMS cannot hold — a
   placeholder row that shows its pending line, a question row with no
   answers, a row with something besides its words — is `withheld` with
   its reason, and the record is then not eligible to write. A section
   that is hidden while empty (`hideWhenEmpty`, no content) draws nothing
   on the page and is left out, with a note. Text the contract refuses
   (working placeholder text, the reserved "inquiry" id, a repeated
   heading) stays in the record, so the planner's contract check blocks
   it by name. */

/* The page ids, in the contract's order (GET_INVOLVED_PAGE_IDS). */
export const GET_INVOLVED_IDS = ["hub", "volunteer", "fellowship", "partner", "travel"];
export const GET_INVOLVED_PATH_IDS = GET_INVOLVED_IDS.slice(1);
/* The address each page has; a source path elsewhere is not that page. */
const ROUTES = { hub: "/get-involved", volunteer: "/get-involved/volunteer", fellowship: "/get-involved/fellowship", partner: "/get-involved/partner", travel: "/get-involved/travel" };

/* A source section's keys: its words, and the website's own settings for it. */
const SECTION_WORDS = new Set(["id", "heading", "body", "items", "faqs"]);
const SECTION_SITE = new Set(["empty", "hideWhenEmpty"]);
/* A source path's keys that are what the path IS — the website's, by design. */
const PATH_SITE = ["slug", "to", "title", "icon", "ctaLabel", "featured", "status"];
const PATH_WORDS = new Set(["id", "shortDescription", "metaDescription", "sections"]);
/* The hub's keys: its words, and the page's own interface copy. */
const HUB_WORDS = new Set(["heading", "body", "ways", "choose", "closing"]);
const HUB_SITE = new Set(["kicker", "why", "related", "questions"]);
const MARKER = "releaseMarker";

const paragraphs = (body) => [].concat(body ?? []).filter((p) => typeof p === "string");
const hasWords = (s) => paragraphs(s.body).length > 0 || (s.items?.length ?? 0) > 0 || (s.faqs?.length ?? 0) > 0;

/* A source object's release marker → withheld, by its path. */
const markerOf = (object, field, withheld) => {
  if (object?.releaseMarker === undefined) return undefined;
  withheld.push({ field, reason: `release marker "${object.releaseMarker}" (sample content: the CMS cannot hold it)`, decision: "sample-content" });
  return object.releaseMarker;
};

/* { paths, hub, ctaRoutes, orgId } → [{ id, record, withheld, notes, releaseMarker? }],
   in the contract's page order. `ctaRoutes` is the website's target →
   route table (snapshot-adapter.mjs CTA_ROUTES). */
export function convertGetInvolved({ paths, hub, ctaRoutes, orgId }) {
  const targetOf = Object.fromEntries(Object.entries(ctaRoutes).map(([target, route]) => [route, target]));
  const envelope = (id) => ({ id, orgId, schemaVersion: 1, status: "draft" });
  const out = [];

  /* ---------- The hub ---------- */
  {
    const withheld = [];
    const notes = [
      "Its kicker, the related-work and questions panels, the pending line and the link prefix of \"What each path involves\" stay the website's (they are the page's own interface copy, not fields of the hub).",
      "\"Why get involved\" is left out on purpose: the website shows the About page's mission statement there, and keeps it while the record has none.",
    ];
    const hubMarker = markerOf(hub, "releaseMarker", withheld);
    for (const key of Object.keys(hub).sort())
      if (!HUB_WORDS.has(key) && !HUB_SITE.has(key) && key !== MARKER) withheld.push({ field: key, reason: "not mapped by the converter — decide where it belongs", decision: "schema-gap" });
    const closing = hub.closing && (() => {
      const cta = (c, which) => {
        if (!c) return undefined;
        const target = targetOf[c.to];
        if (!target) {
          withheld.push({ field: `closing.${which}`, reason: `its link "${c.to}" is not one of the sections a call to action may name (${Object.keys(ctaRoutes).join(", ")})`, decision: "schema-gap" });
          return null;
        }
        return { label: c.label, target };
      };
      if (!hub.closing.ctas?.primary) {
        withheld.push({ field: "closing", reason: "it has no main call to action, which the CMS closing needs", decision: "schema-gap" });
        return undefined;
      }
      const primary = cta(hub.closing.ctas.primary, "primary");
      const secondary = cta(hub.closing.ctas?.secondary, "secondary");
      if (primary === null || secondary === null) return undefined;
      return { heading: hub.closing.heading, primary, ...(secondary && { secondary }) };
    })();
    const record = {
      ...envelope("hub"),
      ...(hub.heading !== undefined && { heading: hub.heading }),
      ...(hub.body !== undefined && { intro: hub.body }),
      ...(hub.ways && { ways: { kicker: hub.ways.kicker, heading: hub.ways.heading } }),
      ...(hub.choose && { choose: { kicker: hub.choose.kicker, heading: hub.choose.heading } }),
      ...(closing && { closing }),
    };
    out.push({ id: "hub", record, withheld, notes, ...(hubMarker !== undefined && { releaseMarker: hubMarker }) });
  }

  /* ---------- The paths, in the contract's order ---------- */
  const notes = hub.choose?.notes ?? {};
  for (const id of GET_INVOLVED_PATH_IDS) {
    const matches = paths.filter((p) => p.id === id);
    if (!matches.length) continue;
    for (const path of matches) {
      const withheld = [];
      const pathNotes = [`What the path is stays the website's: ${PATH_SITE.filter((k) => path[k] !== undefined).join(", ")}; its form and the shared questions and closing panels too.`];
      if (path.to !== undefined && path.to !== ROUTES[id]) withheld.push({ field: "to", reason: `its address "${path.to}" is not the page "${id}" (${ROUTES[id]}) the CMS record names`, decision: "schema-gap" });
      const found = [markerOf(path, "releaseMarker", withheld)];
      for (const key of Object.keys(path).sort())
        if (!PATH_WORDS.has(key) && !PATH_SITE.includes(key) && key !== MARKER) withheld.push({ field: key, reason: "not mapped by the converter — decide where it belongs", decision: "schema-gap" });

      const sections = [];
      let faq;
      const hidden = [];
      (path.sections ?? []).forEach((s, i) => {
        found.push(markerOf(s, `sections.${i}.releaseMarker`, withheld));
        for (const key of Object.keys(s).sort())
          if (!SECTION_WORDS.has(key) && !SECTION_SITE.has(key) && key !== MARKER) withheld.push({ field: `sections.${i}.${key}`, reason: "not mapped by the converter — decide where it belongs", decision: "schema-gap" });
        if (!hasWords(s)) {
          if (s.hideWhenEmpty) hidden.push(s.id);
          else withheld.push({ field: `sections.${i}`, reason: `"${s.heading}" has no words yet and shows its pending line ("${s.empty}"); a CMS section needs words, so the record cannot hold it`, decision: "schema-gap" });
          return;
        }
        if (s.faqs?.length) {
          if (faq || paragraphs(s.body).length || s.items?.length)
            withheld.push({ field: `sections.${i}`, reason: faq ? "a second set of questions — a page has one" : "questions with paragraphs or a list beside them — the CMS keeps questions on their own", decision: "schema-gap" });
          else faq = { heading: s.heading, items: s.faqs.map((f) => ({ question: f.q, answer: f.a })) };
          return;
        }
        sections.push({ id: s.id, heading: s.heading, body: paragraphs(s.body), ...(s.items?.length && { items: [...s.items] }) });
      });
      if (hidden.length) pathNotes.push(`Hidden while empty, so left out (they draw nothing on the page): ${hidden.join(", ")}.`);

      const record = {
        ...envelope(id),
        ...(path.shortDescription !== undefined && { shortDescription: path.shortDescription }),
        ...(notes[id] !== undefined && { hubNote: notes[id] }),
        sections,
        ...(faq && { faq }),
        ...(path.metaDescription !== undefined && { seo: { description: path.metaDescription } }),
      };
      const marker = found.find((m) => m !== undefined);
      out.push({ id, record, withheld, notes: pathNotes, ...(path.status && { sourceStatus: path.status }), ...(marker !== undefined && { releaseMarker: marker }) });
    }
  }
  /* A source path the CMS has no page for: reported, never dropped. */
  for (const path of paths)
    if (!GET_INVOLVED_PATH_IDS.includes(path.id))
      out.push({ id: String(path.id), record: { ...envelope(String(path.id)) }, withheld: [{ field: "id", reason: `the CMS has no Get Involved page "${path.id}" (it has ${GET_INVOLVED_PATH_IDS.join(", ")})`, decision: "schema-gap" }], notes: [], unknown: true });
  return out;
}
