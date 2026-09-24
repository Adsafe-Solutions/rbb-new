/* Content validation — Document 18. Checks the repository content before
   anything is published. scripts/prerender.mjs runs it on every
   production build and STOPS the build on any error, so a malformed
   approved record never becomes a public page. `npm run validate:content`
   runs the same checks on every record — drafts and pending included —
   while content is being prepared.

   Errors (build fails):
     - missing or duplicate ids and slugs; slugs that are not lowercase
       and hyphenated
     - an unknown status, category, program or team group
     - an approved record without its required public fields
     - a reference that does not resolve (story → program / project /
       related story, project → program, policy → policy / contact,
       team link → a real page)
     - an image without a source, a remote image, or meaningful image
       without alt text
     - a page and a redirect on the same address, a redirect to a page
       that does not exist, two pages on one address
     - a secret-shaped value where none may be (a form recipient)
     - the excluded "120+" figure anywhere in the content
     - a javascript:, vbscript: or data: URL anywhere in the content
   Warnings (reported, build continues):
     - an approved record missing a field its page would normally show

   Messages name the file, the record and the field, never the record's
   text, so the report is safe to read in a build log.

   This file ships nowhere: only the build (entry-server.jsx) imports it. */

import { STORIES, STORY_CATEGORIES } from "./stories.js";
import { PROGRAMS, PROJECT_RECORDS } from "./work.js";
import { TEAM_MEMBERS, TEAM_GROUPS } from "./team.js";
import { POLICIES } from "./policies.js";
import { DONATION } from "./donation.js";
import { FORMS } from "./forms.js";
import { TOPICS } from "../lib/formSchema.js";
import { ORG_CONTACT, CAREERS } from "./contact.js";
import * as CONTENT from "./index.js";
import { CREDENTIALS } from "../lib/releaseMarkers.js";

/* The statuses of Document 18. "verified" is the older spelling several
   Document 05–09 modules use for the same meaning as "approved". */
export const STATUSES = [
  "approved",
  "verified",
  "pending-review",
  "draft",
  "archived",
  "placeholder",
];
export const PUBLIC = new Set(["approved", "verified"]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v) => typeof v === "string" && v.trim().length > 0;
const validDate = (v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function validateContent({ pages = [], redirects = [], preview = false } = {}) {
  /* A record the checks treat as public. In `preview` (npm run
     validate:content) every record being prepared is checked as if it
     were approved, so problems surface BEFORE RBB approves it. */
  const live = (status) => (preview ? status !== "archived" : status === "approved");
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  /* ids and slugs: present, well-formed, unique within the collection. */
  const identity = (
    file,
    records,
    { slugField = "slug", statusField = "status" } = {}
  ) => {
    const ids = new Set();
    const slugs = new Set();
    records.forEach((r, i) => {
      const where = `${file}[${r?.id ?? i}]`;
      if (!r || typeof r !== "object")
        return err(`${file}[${i}]`, "is not a record object");
      if (!text(r.id)) err(where, "missing `id`");
      else if (ids.has(r.id)) err(where, `duplicate id "${r.id}"`);
      ids.add(r.id);
      if (slugField) {
        if (!text(r[slugField])) err(where, `missing \`${slugField}\``);
        else if (!SLUG.test(r[slugField]))
          err(where, `slug "${r[slugField]}" must be lowercase words joined by hyphens`);
        else if (slugs.has(r[slugField])) err(where, `duplicate slug "${r[slugField]}"`);
        slugs.add(r[slugField]);
      }
      if (!STATUSES.includes(r[statusField]))
        err(
          where,
          `\`${statusField}\` must be one of ${STATUSES.join(", ")} (got ${JSON.stringify(r[statusField])})`
        );
    });
  };

  /* An image field: a local source, and alt text unless marked decorative. */
  const image = (where, img, { meaningful = true } = {}) => {
    if (img == null) return;
    const src = typeof img === "string" ? img : img.src;
    const alt = typeof img === "string" ? undefined : img.alt;
    if (!text(src)) return err(where, "image has no `src`");
    if (/^https?:\/\//.test(src))
      err(
        where,
        "image must be a local asset — external media needs the Document 17 technology review"
      );
    if (img.decorative === true) {
      if (alt !== "" && alt !== undefined)
        err(where, "a decorative image must have empty alt text");
    } else if (meaningful && !text(alt)) {
      err(where, "image needs alt text describing it (or `decorative: true`)");
    }
  };

  const programSlugs = new Set(PROGRAMS.map((p) => p.slug));
  const storyCategoryIds = new Set(STORY_CATEGORIES.map((c) => c.id));
  const approvedProjectSlugs = new Set(
    PROJECT_RECORDS.filter((p) => live(p.editorialStatus)).map((p) => p.slug)
  );
  const approvedStorySlugs = new Set(STORIES.filter((s) => live(s.status)).map((s) => s.slug));
  const pageSet = new Set(pages);

  /* One content source (Document 27): every record lives in its own
     module and is checked by the same rules, whatever its status. */
  const ALL_STORIES = STORIES;
  const ALL_PROJECTS = PROJECT_RECORDS;
  const ALL_TEAM = TEAM_MEMBERS;
  const ALL_METHODS = DONATION.givingMethods;
  const ALL_FAQS = DONATION.faqs;

  /* ---- Stories (Document 07) ---- */
  identity("stories.js STORIES", ALL_STORIES);
  const featured = ALL_STORIES.filter((s) => live(s.status) && s.featured);
  if (featured.length > 1)
    err(
      "stories.js STORIES",
      `${featured.length} approved stories are marked \`featured\`; only one may be`
    );
  for (const s of ALL_STORIES) {
    const where = `stories.js STORIES[${s?.id}]`;
    if (!s || !live(s.status)) continue;
    if (!text(s.title)) err(where, "approved story needs a `title`");
    if (!storyCategoryIds.has(s.category))
      err(where, `\`category\` must be one of ${[...storyCategoryIds].join(", ")}`);
    if (!text(s.excerpt))
      warn(where, "no `excerpt` — cards and the page description fall back to the title");
    if (s.date != null && !validDate(s.date)) err(where, "`date` must be YYYY-MM-DD");
    if (s.programId != null && !programSlugs.has(s.programId))
      err(where, `\`programId\` "${s.programId}" is not a program`);
    if (s.projectId != null && !approvedProjectSlugs.has(s.projectId))
      err(where, `\`projectId\` "${s.projectId}" is not an approved project`);
    for (const rel of s.relatedStoryIds ?? []) {
      if (rel === s.slug) err(where, "`relatedStoryIds` includes the story itself");
      else if (!approvedStorySlugs.has(rel))
        err(where, `related story "${rel}" is not an approved story`);
    }
    image(`${where}.image`, s.image);
    (s.media ?? []).forEach((m, i) => image(`${where}.media[${i}]`, m));
    (s.quotes ?? []).forEach((q, i) => {
      if (!text(q?.text) || !text(q?.attribution))
        err(`${where}.quotes[${i}]`, "a quote needs `text` and `attribution`");
    });
    if (s.body != null && !(Array.isArray(s.body) && s.body.every(text)))
      err(where, "`body` must be a list of paragraphs");
  }

  /* ---- Projects (Document 04) ---- */
  identity("work.js PROJECT_RECORDS", ALL_PROJECTS, {
    statusField: "editorialStatus",
  });
  for (const p of ALL_PROJECTS) {
    const where = `work.js PROJECT_RECORDS[${p?.id}]`;
    if (!p || !live(p.editorialStatus)) continue;
    if (!text(p.title)) err(where, "approved project needs a `title`");
    if (!programSlugs.has(p.program))
      err(where, `\`program\` must be one of ${[...programSlugs].join(", ")}`);
    if (!text(p.description))
      err(where, "approved project needs a `description` (its card and page summary)");
    if (p.date != null && !validDate(p.date)) err(where, "`date` must be YYYY-MM-DD");
    image(`${where}.image`, p.image);
    (p.impact ?? []).forEach((m, i) => {
      if (!text(String(m?.value ?? "")) || !text(m?.label))
        err(`${where}.impact[${i}]`, "needs `value` and `label`");
    });
    if (p.story?.to && !pageSet.has(p.story.to.split("#")[0]))
      err(where, `\`story.to\` "${p.story.to}" is not a published page`);
  }

  /* ---- Team (Document 10) ---- */
  identity("team.js TEAM_MEMBERS", ALL_TEAM);
  const groupIds = new Set(TEAM_GROUPS.map((g) => g.id));
  for (const m of ALL_TEAM) {
    const where = `team.js TEAM_MEMBERS[${m?.id}]`;
    if (!m || !live(m.status)) continue;
    if (!text(m.name)) err(where, "approved member needs a `name`");
    if (!text(m.role)) err(where, "approved member needs a `role`");
    if (!groupIds.has(m.category))
      err(where, `\`category\` must be one of ${[...groupIds].join(", ")}`);
    if (m.image != null) {
      if (!text(m.image)) err(where, "`image` must be a local asset path");
      else if (/^https?:\/\//.test(m.image)) err(where, "`image` must be a local asset");
      if (!text(m.imageAlt)) err(where, "a photograph needs `imageAlt`");
    }
    if (m.approvedAt != null && !validDate(m.approvedAt))
      err(where, "`approvedAt` must be YYYY-MM-DD");
    for (const l of m.socialLinks ?? [])
      if (!text(l?.label) || !/^https:\/\//.test(l?.url ?? ""))
        err(where, "each social link needs a `label` and an https `url`");
    for (const l of m.relatedLinks ?? [])
      if (!pageSet.has(String(l?.to).split("#")[0]))
        err(where, `related link "${l?.to}" is not a published page`);
    if (m.biography != null && !(Array.isArray(m.biography) && m.biography.every(text)))
      err(where, "`biography` must be a list of paragraphs");
  }

  /* ---- Policies (Document 13) ---- */
  const policyIds = new Set(POLICIES.map((p) => p.id));
  const contactIds = new Set(ORG_CONTACT.methods.map((m) => m.id));
  identity("policies.js POLICIES", POLICIES, { slugField: null });
  for (const p of POLICIES) {
    const where = `policies.js POLICIES[${p.id}]`;
    if (p.route != null && !pageSet.has(p.route))
      err(where, `route "${p.route}" is not a pre-rendered page`);
    for (const d of ["effectiveDate", "lastUpdated"])
      if (p[d] != null && !validDate(p[d])) err(where, `\`${d}\` must be YYYY-MM-DD`);
    for (const rel of p.relatedPolicies ?? [])
      if (!policyIds.has(rel)) err(where, `related policy "${rel}" does not exist`);
    if (p.contactReference != null && !contactIds.has(p.contactReference))
      err(where, `\`contactReference\` "${p.contactReference}" is not a contact method`);
    if (!live(p.status) || p.status === "placeholder") continue;
    if (!p.route) err(where, "an approved policy needs a `route`");
    if (!p.sections?.length) err(where, "an approved policy needs its sections");
    const sectionIds = new Set();
    (p.sections ?? []).forEach((s, i) => {
      if (!text(s?.id) || !SLUG.test(s.id))
        err(`${where}.sections[${i}]`, "needs a lowercase hyphenated `id`");
      else if (sectionIds.has(s.id))
        err(`${where}.sections[${i}]`, `duplicate section id "${s.id}"`);
      sectionIds.add(s?.id);
      if (!text(s?.heading)) err(`${where}.sections[${i}]`, "needs a `heading`");
      if (!(Array.isArray(s?.body) && s.body.every(text)) && !s?.items?.length)
        err(`${where}.sections[${i}]`, "needs `body` paragraphs or `items`");
    });
  }

  /* ---- Donation (Document 11) ---- */
  identity("donation.js givingMethods", ALL_METHODS, { slugField: null });
  for (const m of ALL_METHODS) {
    if (!live(m.status)) continue;
    const where = `donation.js givingMethods[${m.id}]`;
    if (!text(m.label) || !text(m.description))
      err(where, "an approved method needs `label` and `description`");
    if (m.externalUrl != null && !/^https:\/\//.test(m.externalUrl))
      err(where, "`externalUrl` must be https");
  }
  ALL_FAQS.forEach((f, i) => {
    const where = `donation.js faqs[${i}]`;
    if (!STATUSES.includes(f?.status)) err(where, "unknown `status`");
    if (live(f?.status) && (!text(f.q) || !(text(f.a) || Array.isArray(f.a))))
      err(where, "an approved FAQ needs `q` and `a`");
  });

  /* ---- Forms (Document 12): no recipient in client content, ever ---- */
  for (const [name, form] of Object.entries(FORMS)) {
    if (!["draft", "approved", "archived"].includes(form.status))
      err(`forms.js ${name}`, "`status` must be draft, approved or archived");
    if (form.recipient)
      err(
        `forms.js ${name}`,
        "`recipient` must stay null — it is a server setting and would ship to every browser"
      );
  }

  /* The contact form's topics are exactly the server's allowed values
     (lib/formSchema.js) — otherwise a visitor could pick one the server
     rejects (Document 21). */
  const topicField = FORMS.contact.fields.find((f) => f.name === "topic");
  const topicValues = (topicField?.options ?? []).map((o) => o.value);
  if (topicValues.join() !== TOPICS.join())
    err(
      "forms.js contact.topic",
      `options (${topicValues.join(", ")}) must match TOPICS in lib/formSchema.js (${TOPICS.join(", ")})`
    );

  /* ---- Contact (Document 08) ---- */
  identity("contact.js methods", ORG_CONTACT.methods, { slugField: null });
  for (const m of ORG_CONTACT.methods) {
    if (!["email", "phone", "other"].includes(m.type))
      err(`contact.js methods[${m.id}]`, "`type` must be email, phone or other");
    if (PUBLIC.has(m.status) && !text(m.value) && !text(m.href))
      err(`contact.js methods[${m.id}]`, "a verified method needs a `value`");
  }
  for (const r of CAREERS.roles)
    if (!STATUSES.includes(r?.status))
      err("contact.js CAREERS.roles", "every role needs a known `status`");

  /* ---- Routes ---- */
  const seen = new Set();
  for (const p of pages) {
    if (seen.has(p)) err("routes", `two pages on the same address "${p}"`);
    seen.add(p);
  }
  for (const { from, to } of redirects) {
    if (pageSet.has(from)) err("routes", `"${from}" is both a page and a redirect`);
    if (!pageSet.has(to.split("#")[0]))
      err("routes", `redirect "${from}" points to "${to}", which is not a page`);
  }

  /* ---- The excluded figure (Documents 02, 05, 18) ---- */
  const seenObjects = new WeakSet();
  /* Document 24, as Document 27 redraws it: a credential in content is
     always a defect and fails here. Working placeholder wording and
     reserved contact values are NORMAL working content and are not
     checked here — whether the FINAL content has replaced them is a
     release question, answered by scripts/release-status.mjs. */
  const RELEASE_RULES = CREDENTIALS;
  const scan = (value, path) => {
    if (typeof value === "string") {
      const checked = value.replaceAll("name@example.com", "");
      for (const [rule, re] of RELEASE_RULES) if (re.test(checked)) err(path, `contains a ${rule}`);
      if (/\b120\s*\+/.test(value)) err(path, 'contains the excluded "120+" figure');
      /* Document 20: no content value may be an executable or data URL.
         React 18 still renders a `javascript:` href, so a link field
         carrying one would run script on click. */
      if (/^\s*(javascript|vbscript|data):/i.test(value))
        err(
          path,
          "is a javascript:, vbscript: or data: URL, which content may not contain"
        );
      return;
    }
    if (!value || typeof value !== "object" || seenObjects.has(value)) return;
    seenObjects.add(value);
    for (const [k, v] of Object.entries(value)) scan(v, `${path}.${k}`);
  };
  for (const [name, value] of Object.entries(CONTENT))
    if (typeof value !== "function") scan(value, name);

  return {
    errors,
    warnings,
    counts: {
      stories: STORIES.filter((s) => s.status === "approved").length,
      projects: PROJECT_RECORDS.filter((p) => p.editorialStatus === "approved").length,
      team: TEAM_MEMBERS.filter((m) => m.status === "approved").length,
      policies: POLICIES.filter((p) => p.status === "approved").length,
      givingMethods: DONATION.givingMethods.filter((m) => m.status === "approved").length,
      donationFaqs: DONATION.faqs.filter((f) => f.status === "approved").length,
    },
  };
}

export default validateContent;
