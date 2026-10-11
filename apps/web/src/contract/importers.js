/* Current content modules → content-contract records (packages/
   content-schema). BUILD-TIME ONLY: the conformance check
   (src/contract/conformance.js) runs these on every build to prove that
   the content the site renders today fits the contract — the same
   conversion a future CMS import will perform. Nothing on the site reads
   their output; the pages keep reading the content modules.

   Only the appeals are already authored as records (content/appeals.js);
   everything else is converted here from its current shape. What the
   conversion decides:
     · images         the photograph record → its media id
     · links          { label, to } → { label, href }
     · paragraphs     [string] → rich text, for long-form fields
     · status         the editorial vocabulary below → the lifecycle
     · highlights     the words pages/Home passes as JSX literals become
                      the homepage record's own `highlight` fields
   Interface copy — labels, aria text, validation messages, functions —
   stays in the content modules: it belongs to the code, not to the CMS. */
import { ORG_ID } from "./org.js";
import { MEDIA_LIBRARY } from "./media.js";
import { BRAND } from "../content/brand.js";
import { SITE } from "../content/site.js";
import { ANNOUNCEMENTS } from "../content/announcements.js";
import { APPEAL_KINDS, APPEAL_STORIES, APPEALS_PAGES } from "../content/appeals.js";
import { DONATION, approvedDonationFaqs } from "../content/donation.js";
import { HOMEPAGE } from "../content/homepage.js";
import { ABOUT } from "../content/about.js";
import { TEAM_MEMBERS } from "../content/team.js";
import { PROGRAMS, PROJECT_RECORDS } from "../content/work.js";
import { IMPACT, IMPACT_PAGES } from "../content/impact.js";
import { TRANSPARENCY, TRANSPARENCY_COPY, publishedDocuments } from "../content/transparency.js";
import { STORIES, STORY_SOURCE } from "../content/stories.js";
import { BLOGS, EVENTS, NEWS } from "../content/media.js";
import { CAREERS, ORG_CONTACT, verifiedOnly } from "../content/contact.js";
import { ENV } from "../config/env.js";

/* ---------------- Shared conversions ---------------- */

/* The web's editorial statuses → the contract's lifecycle. "placeholder"
   records are rendered today, so they are published; what makes them
   sample content is their `releaseMarker`, which the release system
   reads. Approval for release is never a record status: it is
   release/approvals.mjs. */
const LIFECYCLE = {
  approved: "published",
  verified: "published",
  placeholder: "published",
  "pending-review": "draft",
  draft: "draft",
  archived: "archived",
};
export function fromLegacyStatus(status) {
  const lifecycle = LIFECYCLE[status];
  if (!lifecycle) throw new Error(`No publication state for editorial status "${status}"`);
  return lifecycle;
}

/* Drops undefined fields: a record holds a value or no key at all. */
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

const envelope = (id, status = "published", releaseMarker) =>
  compact({ id, orgId: ORG_ID, schemaVersion: 1, status, releaseMarker });

const BY_IMAGE = new Map(Object.entries(MEDIA_LIBRARY).map(([id, image]) => [image, id]));
const BY_SRC = new Map(Object.entries(MEDIA_LIBRARY).map(([id, image]) => [image.src, id]));
/* A photograph record (or anything carrying its `src`) → its media id. */
export function mediaIdOf(image) {
  if (!image) return undefined;
  // An image from the published snapshot carries its media library id.
  if (image.mediaId) return image.mediaId;
  const id = BY_IMAGE.get(image) ?? BY_SRC.get(image.src);
  if (!id) throw new Error(`Image "${image.alt ?? image.src}" is not in the media registry (src/contract/media.js)`);
  return id;
}

const link = (l) => (l ? { label: l.label, href: l.to ?? l.href } : undefined);
/* Source paragraphs (strings) → rich text; published rich text (from the
   snapshot) is already structured and passes through. */
const richText = (paragraphs) =>
  [].concat(paragraphs).map((block) => (typeof block === "string" ? { type: "paragraph", children: [{ type: "text", text: block }] } : block));

/* ---------------- Collections ---------------- */

export const mediaRecords = () =>
  Object.entries(MEDIA_LIBRARY).map(([id, image]) =>
    compact({ ...envelope(id), kind: "image", alt: image.alt, focal: image.focal })
  );

export const metricRecords = () =>
  IMPACT.metrics.map((m, i) => ({
    ...envelope(m.id),
    slug: m.id,
    order: i,
    value: m.value,
    label: m.label,
    verification: ["verified", "approved"].includes(m.status) ? "verified" : "pending-review",
  }));

/* Stories, news and blog posts — one Post model, three types. */
export function postRecords() {
  const storyIdBySlug = new Map(STORIES.map((s) => [s.slug, s.id]));
  const stories = STORIES.map((s) =>
    compact({
      ...envelope(s.id, fromLegacyStatus(s.status), s.releaseMarker),
      type: "story",
      slug: s.slug,
      title: s.title,
      excerpt: s.excerpt,
      date: s.date,
      category: s.category,
      author: s.author,
      imageId: mediaIdOf(s.image),
      body: richText(s.body),
      programId: s.programId,
      projectId: s.projectId,
      location: s.location,
      featured: s.featured,
      galleryIds: s.media?.map(mediaIdOf),
      /* Milestone 5: as the source writes them — quotes { text, attribution }, impact lines. */
      quotes: s.quotes?.map((q) => compact({ text: q.text, attribution: q.attribution })),
      impact: s.impact,
      /* The story records name related stories by slug. */
      relatedPostIds: s.relatedStoryIds?.map((slug) => storyIdBySlug.get(slug) ?? `missing:${slug}`),
    })
  );
  const news = NEWS.map((n) =>
    compact({
      ...envelope(n.id, fromLegacyStatus(n.status), n.releaseMarker),
      type: "news",
      slug: n.id,
      title: n.title,
      excerpt: n.summary,
      date: n.date,
      imageId: mediaIdOf(n.image),
      body: richText(n.body),
      programId: n.program,
      seo: n.seo && compact(n.seo),
    })
  );
  const blogs = BLOGS.map((b) =>
    compact({
      ...envelope(b.id, fromLegacyStatus(b.status), b.releaseMarker),
      type: "blog",
      slug: b.id,
      title: b.title,
      excerpt: b.excerpt,
      date: b.date,
      category: b.category,
      author: b.author,
      imageId: mediaIdOf(b.image),
      body: richText(b.body),
      seo: b.seo && compact(b.seo),
    })
  );
  return [...stories, ...news, ...blogs];
}

export const eventRecords = () =>
  EVENTS.map((e) =>
    compact({
      ...envelope(e.id, fromLegacyStatus(e.status), e.releaseMarker),
      slug: e.id,
      title: e.title,
      subtitle: e.subtitle,
      summary: e.summary,
      about: richText(e.about),
      date: e.date,
      startTime: e.start,
      endTime: e.end,
      programId: e.program === "open" ? null : e.program,
      venue: e.venue,
      address: e.address,
      mapUrl: e.mapUrl ?? undefined,
      timezone: e.timezone,
      registrationUrl: e.registrationUrl,
      seo: e.seo && compact(e.seo),
      schedule: e.schedule.map(({ time, item }) => compact({ time: time || undefined, item })),
      imageId: mediaIdOf(e.image),
    })
  );

export const announcementRecords = () =>
  ANNOUNCEMENTS.bar.items.map((item, order) =>
    compact({ ...envelope(item.id, "published", item.releaseMarker), text: item.text, link: link(item.link), order })
  );

export function popupRecord() {
  const p = ANNOUNCEMENTS.popup;
  return compact({
    /* A published CMS popup (M22) clears the parts it leaves out with null. */
    ...envelope(p.id, "published", p.releaseMarker ?? undefined),
    key: p.id,
    kicker: p.kicker ?? undefined,
    heading: p.heading,
    highlight: p.highlight ?? undefined,
    body: p.body,
    imageId: mediaIdOf(p.image),
    cta: link(p.cta),
    dismissLabel: p.dismiss,
    delayMs: p.delayMs,
    frequency: p.frequency,
    excludePaths: p.excludePaths,
  });
}

/* /appeals, as the page draws it (pages/Appeals): the general donation
   hero, then why → how → the two appeal lists → transparency → FAQ. */
export function generalDonationRecord() {
  const { general, whyGive, impact, trust, faq } = DONATION;
  const faqs = approvedDonationFaqs();
  return {
    ...envelope("general-donation"),
    hero: compact({
      eyebrow: APPEALS_PAGES.hub.heading,
      title: general.title,
      description: general.description,
      imageId: mediaIdOf(general.image),
      context: general.context && compact({ label: general.context.label, body: general.context.body }),
    }),
    sections: [
      block(whyGive.id, "statement", compact({ kicker: whyGive.kicker, heading: whyGive.heading, body: whyGive.body, cta: link(whyGive.cta) })),
      block(impact.id, "numberedCards", compact({ kicker: impact.kicker, heading: impact.heading, intro: impact.intro, items: impact.items.map((i) => compact(i)) })),
      ...APPEAL_KINDS.map((kind) =>
        block(kind.id, "appealList", {
          kicker: kind.kicker,
          heading: kind.label,
          kind: kind.id === "campaigns" ? "campaign" : kind.id,
          cta: { label: `${APPEALS_PAGES.hub.listCta} ${kind.label}`, href: kind.to },
        })
      ),
      block(trust.id, "trust", compact({ kicker: trust.kicker, heading: trust.heading, body: trust.body, cta: link(trust.cta) })),
      ...(faqs.length
        ? [block(faq.id, "faq", { kicker: faq.kicker, heading: faq.heading, items: faqs.map((f) => compact({ question: f.q, answer: f.a, releaseMarker: f.releaseMarker })) })]
        : []),
    ],
    donation: { designation: "where-needed-most" },
  };
}

function block(id, type, data) {
  return { id, type, enabled: true, version: 1, data };
}

export function homepageRecord() {
  const h = HOMEPAGE;
  /* The source homepage as the contract's ordered blocks, in the page's
     own order (pages/Home). The film is a block only while it has one. */
  const block = (id, type, data) => ({ id, type, enabled: true, version: 1, data });
  return compact({
    ...envelope("homepage"),
    sections: [
      block("hero", "hero", {
        slides: h.hero.slides.map((s) => ({
          id: s.id,
          headline: s.headline,
          cta: link(s.cta),
          imageId: mediaIdOf(s.image),
          insetId: mediaIdOf(s.inset),
        })),
        secondaryCta: link(h.hero.ctas.secondary),
        intervalMs: h.hero.interval,
      }),
      /* pages/Home draws the collage's wide photograph and the "with
         people" highlight. */
      block("who-we-are", "imageText", compact({
        kicker: h.whoWeAre.kicker,
        heading: h.whoWeAre.heading,
        highlight: "with people",
        body: h.whoWeAre.body,
        imageId: mediaIdOf(h.whoWeAre.collage.photos.wide),
        cta: link(h.whoWeAre.cta),
        secondaryCta: link(h.whoWeAre.collage.secondary),
      })),
      block("programs", "programs", { kicker: h.programs.kicker, heading: h.programs.heading }),
      block("approach", "approach", compact({ kicker: h.approach.kicker, heading: h.approach.heading, body: h.approach.intro, cta: link(h.approach.cta) })),
      block("impact", "stats", compact({
        kicker: h.impact.kicker,
        heading: h.impact.heading,
        body: h.impact.body,
        metricIds: IMPACT.metrics.map((m) => m.id),
        source: h.impact.source,
        cta: link(h.impact.cta),
      })),
      block("timeline", "timeline", {
        kicker: h.timeline.kicker,
        heading: h.timeline.heading,
        cta: link(h.timeline.cta),
        items: h.timeline.events.map((e) =>
          compact({
            id: e.id,
            date: e.date,
            programId: e.program,
            title: e.title,
            summary: e.summary,
            youtubeId: e.youtubeId,
            videoTitle: e.videoTitle,
            posterId: mediaIdOf(e.poster),
            releaseMarker: e.releaseMarker,
          })
        ),
      }),
      block("stories", "stories", { kicker: h.stories.kicker, heading: h.stories.heading, cta: link(h.stories.cta), count: h.stories.slots }),
      ...(h.video.youtubeId
        ? [
            block("video", "video", compact({
              kicker: h.video.kicker,
              heading: h.video.heading,
              highlight: "up close",
              body: h.video.body,
              youtubeId: h.video.youtubeId,
              title: h.video.title,
              posterId: mediaIdOf(h.video.poster),
              releaseMarker: h.video.releaseMarker,
            })),
          ]
        : []),
      block("transparency", "trust", compact({ kicker: h.transparency.kicker, heading: h.transparency.heading, body: h.transparency.body, cta: link(h.transparency.cta) })),
      block("get-involved", "getInvolved", {
        kicker: h.getInvolved.kicker,
        heading: h.getInvolved.heading,
        imageIds: Object.fromEntries(h.getInvolved.tabs.map((tab) => [tab.key, mediaIdOf(tab)])),
      }),
      block("faq", "faq", {
        kicker: h.faq.kicker,
        heading: h.faq.heading,
        highlight: "questions",
        items: h.faq.items.map((f) => compact({ question: f.q, answer: f.a, releaseMarker: f.releaseMarker })),
      }),
      block("final-cta", "cta", compact({
        heading: h.finalCta.heading,
        highlight: "beyond borders",
        body: h.finalCta.body,
        primary: link(h.finalCta.ctas.primary),
        secondary: link(h.finalCta.ctas.secondary),
        imageId: mediaIdOf(h.finalCta.image),
        cardImageId: mediaIdOf(h.finalCta.cardImage),
      })),
    ],
  });
}

/* The source About page as the contract's ordered blocks, in the page's
   own order (pages/About). Block ids are the chapters' own addresses. The
   transparency chapter is a placement: its content is the transparency
   records', not the About page's. */
export function aboutRecord() {
  const a = ABOUT;
  const block = (id, type, data) => ({ id, type, enabled: true, version: 1, data });
  return compact({
    ...envelope("about"),
    sections: [
      block("intro", "pageHero", compact({ title: a.hero.kicker, crumb: a.hero.crumb, body: a.hero.body, cta: link(a.hero.cta) })),
      /* pages/About draws the "solutions" highlight. */
      block(a.whoWeAre.id, "statement", compact({ kicker: a.whoWeAre.kicker, heading: a.whoWeAre.heading, highlight: "solutions", body: a.whoWeAre.body })),
      block(a.missionVision.id, "missionVision", compact({ kicker: a.missionVision.kicker, heading: a.missionVision.heading, mission: a.missionVision.mission, vision: a.missionVision.vision, source: a.missionVision.source })),
      block(a.values.id, "numberedCards", { kicker: a.values.kicker, heading: a.values.heading, items: a.values.items.map((v) => compact({ title: v.title, description: v.description })) }),
      block(a.approach.id, "approach", compact({ kicker: a.approach.kicker, heading: a.approach.heading, body: a.approach.intro, cta: link(a.approach.cta) })),
      block("transparency", "transparency", {}),
      block("closing", "cta", compact({ heading: a.closingCta.heading, primary: link(a.closingCta.ctas.primary), secondary: link(a.closingCta.ctas.secondary) })),
    ],
  });
}

/* The source Impact page as the contract's ordered blocks, in /impact's
   own order (pages/Impact). Its figures, programs and stories are NAMED
   (the figures' keys are their source ids). The two posters are the ones
   /impact shows today: with no verified geography, Our approach and Our
   work. */
export function impactRecord() {
  const t = IMPACT_PAGES.overview;
  const { geography, approach, measurement } = IMPACT;
  const block = (id, type, data) => ({ id, type, enabled: true, version: 1, data });
  const teaser = (x) => compact({ kicker: x.kicker, heading: x.heading, body: x.body ?? x.empty, cta: link(x.cta) });
  const hasGeography = geography.regions.length || geography.countries.length;
  const first = hasGeography ? { ...t.teasers.whereWeWork, body: geography.summary ?? undefined } : { ...t.teasers.approach, body: approach.intro ?? undefined };
  const second = hasGeography ? { ...t.teasers.approach, body: approach.intro ?? undefined } : t.teasers.work;
  return compact({
    ...envelope("impact"),
    sections: [
      /* pages/Impact draws the "Impact" highlight. */
      block("intro", "intro", compact({ kicker: t.kicker, title: t.heading, highlight: "Impact", body: t.body })),
      block(t.glance.id, "stats", compact({ kicker: t.glance.kicker, heading: t.glance.heading, metricIds: IMPACT.metrics.map((m) => m.id), source: IMPACT.metricsSource })),
      block("programs", "programImpact", { kicker: t.programs.kicker, heading: t.programs.heading, items: IMPACT.programImpact.map((p) => ({ programId: p.programId, summary: p.summary })) }),
      block("teasers", "teasers", { items: [teaser(first), teaser(second)] }),
      block("measurement", "measurement", compact({ heading: t.measurement.heading, body: measurement.intro ?? undefined, items: [...measurement.methods, ...measurement.evidence] })),
      /* The website's own stories, by slug — only while they are the site's
         stories (M15: once the CMS's stories replace them, the page names
         none, as it draws none: never a CMS story by a coincidental slug). */
      block(t.stories.id, "stories", compact({ kicker: t.stories.kicker, heading: t.stories.heading, storyIds: STORY_SOURCE.cms ? [] : IMPACT.stories.map((slug) => STORIES.find((s) => s.slug === slug)?.id ?? `missing:${slug}`), cta: link(t.stories.cta) })),
      block("reports", "trust", compact({ kicker: t.reports.kicker, heading: t.reports.heading, body: t.reports.body, cta: link(t.reports.cta) })),
      block("closing", "cta", compact({ heading: t.closing.heading, primary: link(t.closing.ctas.primary), secondary: link(t.closing.ctas.secondary) })),
    ],
  });
}

/* The source transparency content as the Transparency record: the
   chapter's words, the financial overview, governance and "How we
   report" (content/transparency.js). */
export function transparencyRecord() {
  const t = TRANSPARENCY_COPY;
  const { financialOverview, governance, accountability } = TRANSPARENCY;
  const hasGovernance = Boolean(governance.intro || governance.sections.length);
  return compact({
    ...envelope("transparency"),
    kicker: t.kicker,
    heading: t.heading,
    intro: t.body,
    financialOverview: {
      year: financialOverview.year,
      verification: financialOverview.status === "verified" ? "verified" : "pending-review",
      items: financialOverview.items.map(({ id, label, percentage }) => ({ id, label, percentage })),
    },
    governance: hasGovernance ? compact({ intro: governance.intro ?? undefined, sections: governance.sections.length ? governance.sections : undefined }) : undefined,
    accountability: accountability.intro ? [accountability.intro].flat() : undefined,
  });
}

/* The source transparency documents as Report records — the published
   ones with a file (none yet: content/transparency.js lists nothing
   without a real, approved file). */
export function reportRecords() {
  const lists = [["annualReport", TRANSPARENCY.annualReports], ["financial", TRANSPARENCY.financialDocuments], ["governance", TRANSPARENCY.governanceDocuments]];
  return lists.flatMap(([category, docs]) =>
    publishedDocuments(docs).map((d, i) => compact({ ...envelope(d.id), slug: d.id, category, title: d.title, year: d.year, type: d.type, fileUrl: d.fileUrl, order: i }))
  );
}

/* The source projects as Project records, in their list order. Milestone
   6: a location, a stage (the record's `status`, distinct from its
   editorial status), a date, verified impact, partners and a story are
   contract fields. A source project's story is a copy ({ title, excerpt,
   to }); the contract names the story by id, so a copy that is exactly the
   story's own (found by its address) becomes that id — any other copy is
   passed through as `story`, so conformance fails loudly instead of losing
   its words. */
const storyReference = (story) => {
  if (!story) return {};
  const slug = /^\/stories\/([^/#?]+)$/.exec(story.to ?? "")?.[1];
  const own = slug && STORIES.find((s) => s.slug === slug);
  return own && own.title === story.title && (story.excerpt === undefined || story.excerpt === own.excerpt) ? { storyId: own.id } : { story };
};
export function projectRecords() {
  return PROJECT_RECORDS.map((p, i) =>
    compact({
      ...envelope(p.id, fromLegacyStatus(p.editorialStatus), p.releaseMarker),
      slug: p.slug,
      title: p.title,
      programId: p.program,
      description: p.description,
      imageId: mediaIdOf(p.image),
      context: p.context,
      activities: p.activities,
      approach: p.approach,
      outcomes: p.outcomes,
      featured: p.featured,
      order: i,
      location: p.location,
      stage: p.status,
      date: p.date,
      impact: p.impact,
      partners: p.partners,
      ...storyReference(p.story),
    })
  );
}

/* The source Careers page as the Careers record: its header, its three
   sections (an absent one stays absent), the open roles (only verified
   ones are on the page) and the closing ask; the meta description is the
   record's SEO description. */
export function careersRecord() {
  const c = CAREERS;
  const section = (id) => {
    const s = c.sections.find((x) => x.id === id);
    return s?.body ? { heading: s.heading, body: s.body } : undefined;
  };
  const opportunities = c.sections.find((x) => x.id === "opportunities");
  return compact({
    ...envelope("careers"),
    kicker: c.kicker,
    title: c.title,
    intro: c.body,
    why: section("why"),
    opportunities: { heading: opportunities.heading, empty: opportunities.empty, roles: c.roles.filter((r) => r.status === "verified").map((r) => ({ title: r.title })) },
    apply: section("apply"),
    closing: compact({ heading: c.closing.heading, primary: link(c.closing.ctas.primary), secondary: link(c.closing.ctas.secondary) }),
    seo: c.metaDescription ? { description: c.metaDescription } : undefined,
  });
}

/* The source team as TeamMember records. A source record that is not
   approved is a draft; the sample profiles keep their release marker. */
export function teamRecords() {
  return TEAM_MEMBERS.map((m) =>
    compact({
      ...envelope(m.id, m.status === "approved" ? "published" : m.status === "archived" ? "archived" : "draft", m.releaseMarker),
      slug: m.slug,
      name: m.name,
      role: m.role,
      group: m.category,
      order: m.order ?? 0,
      featured: m.featured,
      shortBio: m.shortBio,
      biography: m.biography,
      imageId: m.imageId ?? (m.image ? mediaIdOf({ src: m.image }) : undefined),
      departmentOrArea: m.departmentOrArea,
      location: m.location,
      socialLinks: m.socialLinks?.map((l) => ({ label: l.label, url: l.url })),
      relatedLinks: m.relatedLinks?.map((l) => ({ label: l.label, href: l.to })),
    })
  );
}

/* The source program areas as Program records, in their order. `to` is
   derived from the slug (/work/<slug>) and checked to be. */
export function programRecords() {
  return PROGRAMS.map((p, i) => {
    if (p.to !== `/work/${p.slug}`) throw new Error(`Program "${p.slug}": its address must be /work/${p.slug} (src/content/work.js)`);
    return compact({
      ...envelope(p.slug),
      slug: p.slug,
      title: p.title,
      icon: p.icon,
      order: i,
      description: p.description,
      missingNote: p.missing,
      why: p.why === undefined ? undefined : [].concat(p.why),
      activities: p.activities?.length ? p.activities : undefined,
      impact: p.impact?.length ? p.impact : undefined,
      stories: p.stories?.length ? p.stories : undefined,
    });
  });
}

/* Organization settings — public configuration only. Contact details:
   only what content/contact.js marks verified. */
export function siteSettingsRecord() {
  const office = ORG_CONTACT.office;
  const shown = (block) => (block.status === "verified" && block.value ? block.value : undefined);
  return {
    ...envelope("site-settings"),
    general: { shortName: BRAND.name, name: BRAND.fullName, summary: BRAND.summary },
    contact: compact({
      methods: verifiedOnly(ORG_CONTACT.methods).map((m) =>
        compact({ id: m.id, type: m.type, label: m.label, value: m.value, href: m.href, description: m.description })
      ),
      office:
        office.status === "verified" && office.address
          ? compact({ address: office.address, city: office.city ?? undefined, region: office.region ?? undefined, country: office.country ?? undefined, mapUrl: office.mapUrl ?? undefined })
          : undefined,
      hours: shown(ORG_CONTACT.hours),
      responseTime: shown(ORG_CONTACT.responseTime),
    }),
    social: verifiedOnly(ORG_CONTACT.social).map((s) => ({ platform: s.platform, url: s.url })),
    seo: { description: SITE.description },
    branding: {},
    analytics: {},
    donations: {
      form: DONATION.form.config,
      closing: { heading: DONATION.closing.heading, buttonLabel: DONATION.closing.cta },
    },
    engagement: {
      announcementBar: { enabled: ANNOUNCEMENTS.bar.enabled, intervalMs: ANNOUNCEMENTS.bar.interval },
      popup: { enabled: ANNOUNCEMENTS.popup.enabled },
      storyStrip: { enabled: APPEAL_STORIES.enabled },
    },
    features: { themeSwitcher: ENV.themeSwitcher },
  };
}
