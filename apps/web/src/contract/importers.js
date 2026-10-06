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
import { IMPACT } from "../content/impact.js";
import { STORIES } from "../content/stories.js";
import { BLOGS, EVENTS, NEWS } from "../content/media.js";
import { ORG_CONTACT, verifiedOnly } from "../content/contact.js";
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
  const id = BY_IMAGE.get(image) ?? BY_SRC.get(image.src);
  if (!id) throw new Error(`Image "${image.alt ?? image.src}" is not in the media registry (src/contract/media.js)`);
  return id;
}

const link = (l) => (l ? { label: l.label, href: l.to ?? l.href } : undefined);
const richText = (paragraphs) =>
  [].concat(paragraphs).map((text) => ({ type: "paragraph", children: [{ type: "text", text }] }));

/* ---------------- Collections ---------------- */

export const mediaRecords = () =>
  Object.entries(MEDIA_LIBRARY).map(([id, image]) =>
    compact({ ...envelope(id), kind: "image", alt: image.alt, focal: image.focal })
  );

export const metricRecords = () =>
  IMPACT.metrics.map((m) => ({
    ...envelope(m.id),
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
    ...envelope(p.id, "published", p.releaseMarker),
    key: p.id,
    kicker: p.kicker,
    heading: p.heading,
    highlight: p.highlight,
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
  return compact({
    ...envelope("homepage"),
    hero: {
      slides: h.hero.slides.map((s) => ({
        id: s.id,
        headline: s.headline,
        cta: link(s.cta),
        imageId: mediaIdOf(s.image),
        insetId: mediaIdOf(s.inset),
      })),
      secondaryCta: link(h.hero.ctas.secondary),
      intervalMs: h.hero.interval,
    },
    /* pages/Home draws the collage's wide photograph and the "with
       people" highlight. */
    whoWeAre: compact({
      kicker: h.whoWeAre.kicker,
      heading: h.whoWeAre.heading,
      highlight: "with people",
      body: h.whoWeAre.body,
      imageId: mediaIdOf(h.whoWeAre.collage.photos.wide),
      cta: link(h.whoWeAre.cta),
      secondaryCta: link(h.whoWeAre.collage.secondary),
    }),
    programs: { kicker: h.programs.kicker, heading: h.programs.heading },
    approach: compact({ kicker: h.approach.kicker, heading: h.approach.heading, body: h.approach.intro, cta: link(h.approach.cta) }),
    impact: compact({
      kicker: h.impact.kicker,
      heading: h.impact.heading,
      body: h.impact.body,
      metricIds: IMPACT.metrics.map((m) => m.id),
      source: h.impact.source,
      cta: link(h.impact.cta),
    }),
    timeline: {
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
    },
    stories: { kicker: h.stories.kicker, heading: h.stories.heading, cta: link(h.stories.cta), count: h.stories.slots },
    video: h.video.youtubeId
      ? compact({
          kicker: h.video.kicker,
          heading: h.video.heading,
          highlight: "up close",
          body: h.video.body,
          youtubeId: h.video.youtubeId,
          title: h.video.title,
          posterId: mediaIdOf(h.video.poster),
          releaseMarker: h.video.releaseMarker,
        })
      : undefined,
    transparency: compact({ kicker: h.transparency.kicker, heading: h.transparency.heading, body: h.transparency.body, cta: link(h.transparency.cta) }),
    getInvolved: {
      kicker: h.getInvolved.kicker,
      heading: h.getInvolved.heading,
      imageIds: Object.fromEntries(h.getInvolved.tabs.map((tab) => [tab.key, mediaIdOf(tab)])),
    },
    faq: {
      kicker: h.faq.kicker,
      heading: h.faq.heading,
      highlight: "questions",
      items: h.faq.items.map((f) => compact({ question: f.q, answer: f.a, releaseMarker: f.releaseMarker })),
    },
    finalCta: compact({
      heading: h.finalCta.heading,
      highlight: "beyond borders",
      body: h.finalCta.body,
      primary: link(h.finalCta.ctas.primary),
      secondary: link(h.finalCta.ctas.secondary),
      imageId: mediaIdOf(h.finalCta.image),
      cardImageId: mediaIdOf(h.finalCta.cardImage),
    }),
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
