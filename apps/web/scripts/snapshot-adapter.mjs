/* Published snapshot → the content modules the site already renders from.

   The site keeps reading its content modules (src/content/*). When a build
   has a published snapshot (scripts/published-snapshot.mjs fetched it),
   the Vite plugin below sets these exports from it — in the client build
   AND the server build, so the pre-rendered HTML and the hydrated page
   agree. Without a snapshot nothing is touched: the source content is the
   site, byte for byte.

   WHAT the snapshot drives today (SiteSettings → view models):

     general.shortName / name / summary   BRAND.name / fullName / summary
     seo.description                      SITE.description (default meta description)
     contact.methods / office / hours /   ORG_CONTACT.methods / office / hours /
       responseTime                         responseTime   (published = "verified")
     social                               ORG_CONTACT.social → the footer icons

   Everything derived from these at module load (SITE.name, the footer's
   socials, page titles) follows automatically, because the values are set
   at the end of the module that defines them, before anything imports it.

     content.news   → NEWS   (/media/news)      a collection the CMS manages
     content.blogs  → BLOGS  (/media/blogs)     replaces the source list
     content.events → EVENTS (/media/events)    entirely — published records only
     content.appeals → APPEALS (/appeals/emergency|campaigns/<slug>, the
                       Appeals menu, the story circles)
     content.generalDonation → PUBLISHED_GENERAL_DONATION (/appeals: the
                       general donation page — only while it is PUBLISHED
                       in the CMS)
     content.homepage → PUBLISHED_HOMEPAGE (/: the homepage's blocks, in
                       order — only while it is PUBLISHED in the CMS;
                       pages/Home/CmsHome draws them)
     content.about  → PUBLISHED_ABOUT (/about: the About page's blocks —
                       only while it is PUBLISHED; pages/About/CmsAbout)
     content.team   → TEAM_MEMBERS (/about/team, the profiles, /about's
                       featured people) — a collection: present once the
                       organization has any team member in the CMS
     content.programs → PROGRAMS (/work, /work/<slug>, the menu, the
                       homepage's program cards, every record that names a
                       program) — present once the organization has
                       PUBLISHED a program in the CMS
     content.metrics → IMPACT.metrics (the headline figures every `stats`
                       block names — homepage and /impact) — present once
                       the organization has PUBLISHED a figure
     content.impact → PUBLISHED_IMPACT (/impact: the Impact page's blocks —
                       only while it is PUBLISHED; pages/Impact/CmsImpact)
     content.transparency → TRANSPARENCY / TRANSPARENCY_COPY (the
                       Transparency chapter of /about, and the rows every
                       trust panel shows) — only while it is PUBLISHED
     content.reports → TRANSPARENCY's three document lists — present once
                       the organization has PUBLISHED a document
     content.stories → STORIES (/stories, /stories/<slug>, the homepage's
                       newest stories, /impact's stories, related stories)
                       — present once the organization has PUBLISHED a
                       story; newest first, then as added. STORY_SOURCE
                       says so (M15): the CMS's stories are then the only
                       stories, and the website's own Impact page (which
                       names the website's own stories) shows none
     content.careers → CAREERS (/about-us/careers: its header, sections,
                       open roles and closing ask) — only while it is
                       PUBLISHED
     content.policies → POLICIES, by id (/privacy, /terms, /donation-policy,
                       the footer's legal links, the forms' privacy link,
                       the donation form's policy link, SEO) — each policy
                       the CMS has PUBLISHED replaces the website's record
                       and its working text, and is final; a policy the
                       snapshot does not carry keeps the source record.
                       Its id and route are the website's, never the CMS's
     content.getInvolved → GET_INVOLVED.paths (by id) and
                       GET_INVOLVED_PAGES.hub (/get-involved and its four
                       paths, and every place a path's line, sections or
                       description is read: cards, menu, footer, forms,
                       SEO) — each page the CMS has PUBLISHED replaces the
                       words it holds; what it leaves out, and everything
                       that makes a path what it is (title, route, icon,
                       images, form), stays the site's
     content.announcementBar → ANNOUNCEMENTS.bar.items (the messages in the
                       bar over the header) — only while the bar is
                       PUBLISHED; absent, the site's own messages stay
     settings.engagement.announcementBar → ANNOUNCEMENTS.bar.enabled and
                       .interval (M21) — whether the bar shows and how long
                       each message stays. A deployment's
                       VITE_ANNOUNCEMENT_BAR still overrides `enabled`
                       (config/sections.js), and the bar never shows
                       without a message
     content.popup  → ANNOUNCEMENTS.popup (the on-screen popup) — only
                       while it is PUBLISHED; absent, the site's own popup
                       stays
     settings.engagement.popup → ANNOUNCEMENTS.popup.enabled (M22) — in
                       every snapshot build; VITE_SITE_POPUP still
                       overrides it (config/sections.js)
     content.storyStrip → APPEAL_STORIES.order (Highlights, M23: which
                       published appeals the story circles show, in
                       order) — only while it is PUBLISHED; absent, the
                       site's rule stays (highlighted appeals, newest
                       first). Each circle's label and photo stay the
                       appeal's own. A published strip also REWRITES one
                       expression in content/appeals.js (STORY_REWRITE)
     settings.engagement.storyStrip → APPEAL_STORIES.enabled (M23) — in
                       every snapshot build; VITE_STORY_STRIP still
                       overrides it (config/sections.js)
     content.projects → PROJECT_RECORDS and PROJECTS (/work/projects,
                       /work/projects/<slug>, the program pages, /work's and
                       the homepage's featured projects, the project
                       timeline) — present once one is PUBLISHED; PROJECT_SOURCE
                       then says so (M31.1: the website's own stories'
                       project references are not held against them)
   A collection the snapshot does not carry (it has never been on the
   website — Milestone 1 — or, for programs, figures, documents, stories
   and projects, none is published) keeps the source content.

   A page with a Givebutter checkout gets it as { provider, widgetType,
   widgetId, amount?, frequency? } — what src/integrations/donations
   draws. Public ids only: the account id is the build's own
   VITE_GIVEBUTTER_ACCOUNT_ID, and no key is ever in a snapshot.

   NOT driven yet, on purpose — the settings exist, the site does not read
   them from the CMS until the milestone that owns each:
     branding (logo/favicon)  the site's logo is supplied artwork; using R2
                              media needs the CSP and image pipeline first
     analytics                measurement is environment configuration and
                              off until RBB approves it (config/env.js)
     donations                the site-wide form defaults (the CMS's
                              donation pages above carry their own checkout)
     features                 the theme switcher (the announcement bar's,
                              the popup's and the story strip's switches
                              ARE driven since M21–M23, above) */

import { workingContentFindings } from "../src/lib/releaseMarkers.js";
import { focalPosition } from "../src/lib/focal.js";

/* The platforms the footer knows, with the label its links use. */
export const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube" };

/* file (relative to apps/web) → the export the snapshot sets in it */
export const SNAPSHOT_TARGETS = {
  "src/content/brand.js": "BRAND",
  "src/content/site.js": "SITE",
  "src/content/contact.js": "ORG_CONTACT, CAREERS",
  "src/content/media.js": "NEWS, BLOGS, EVENTS",
  "src/content/appeals.js": "APPEALS, APPEAL_STORIES",
  "src/content/donation.js": "PUBLISHED_GENERAL_DONATION",
  "src/content/homepage.js": "PUBLISHED_HOMEPAGE",
  "src/content/about.js": "PUBLISHED_ABOUT",
  "src/content/team.js": "TEAM_MEMBERS",
  "src/content/work.js": "PROGRAMS, PROJECT_RECORDS, PROJECTS, PROJECT_SOURCE",
  "src/content/stories.js": "STORIES, STORY_SOURCE",
  "src/content/impact.js": "IMPACT, PUBLISHED_IMPACT",
  "src/content/transparency.js": "TRANSPARENCY, TRANSPARENCY_COPY",
  "src/content/policies.js": "POLICIES (by id)",
  "src/content/getInvolved.js": "GET_INVOLVED.paths (by id), GET_INVOLVED_PAGES.hub",
  "src/content/announcements.js": "ANNOUNCEMENTS.bar, ANNOUNCEMENTS.popup",
};

/* A published media record → the image object the pages draw. Milestone 2:
   its focal point (only a valid one — lib/focal.js) and its caption come
   with it, when it has them; otherwise the image is drawn as before. */
const imageOf = (snapshot, id) => {
  const m = id ? snapshot.media[id] : undefined;
  if (!m) return undefined;
  const focal = focalPosition(m.focal);
  const caption = typeof m.caption === "string" ? m.caption.trim() : "";
  return { src: m.url, alt: m.alt, ...(m.width && { width: m.width }), ...(m.height && { height: m.height }), ...(focal && { focal }), ...(caption && { caption }), mediaId: m.id };
};
const dayOf = (record, snapshot) => record.date ?? (record.publishedAt ?? snapshot.generatedAt).slice(0, 10);
const byDate = (direction) => (a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date) * direction);
/* A record's sharing metadata (SeoOverrides) → what its page's meta reads:
   title, description, a share image (src and alt, from the media library)
   and noIndex — each only when set (Milestone 3: news, blogs, events,
   appeals and the donation page carried title and description only). */
const seoOf = (snapshot, seo) => {
  if (!seo) return undefined;
  const image = imageOf(snapshot, seo.ogImageId);
  const view = drop({ title: seo.title, description: seo.description, image: image?.src, imageAlt: image?.alt, noIndex: seo.noIndex || undefined });
  return Object.keys(view).length ? view : undefined;
};
const drop = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

/* Published posts and events → the view models of src/content/media.js.
   An optional field a record leaves out is left out here too — never an
   empty string, which the content contract rejects.
   `body`/`about` stay structured rich text (pages render it with
   components/RichText); `status: "approved"` is the site's word for a
   record that may be shown. Only collections the snapshot carries. */
export function collectionsFrom(snapshot) {
  const c = snapshot.content ?? {};
  const out = {};
  if (c.news)
    out.NEWS = c.news
      .map((p) => drop({ id: p.slug, date: dayOf(p, snapshot), program: p.programId, title: p.title, summary: p.excerpt, body: p.body, image: imageOf(snapshot, p.imageId), seo: seoOf(snapshot, p.seo), status: "approved" }))
      .sort(byDate(1)); // oldest first: the news page is a timeline
  if (c.blogs)
    out.BLOGS = c.blogs
      .map((p) => drop({ id: p.slug, date: dayOf(p, snapshot), category: p.category, title: p.title, excerpt: p.excerpt, author: p.author, body: p.body, image: imageOf(snapshot, p.imageId), seo: seoOf(snapshot, p.seo), status: "approved" }))
      .sort(byDate(-1));
  if (c.events)
    out.EVENTS = c.events
      .map((e) =>
        drop({
          id: e.slug,
          date: e.date,
          start: e.startTime,
          end: e.endTime,
          timezone: e.timezone,
          program: e.programId ?? "open",
          title: e.title,
          subtitle: e.subtitle,
          summary: e.summary,
          about: e.about,
          schedule: e.schedule.map(({ time, item }) => ({ time: time ?? "", item })),
          venue: e.venue,
          address: e.address,
          mapUrl: e.mapUrl ?? null,
          registrationUrl: e.registrationUrl,
          image: imageOf(snapshot, e.imageId),
          seo: seoOf(snapshot, e.seo),
          status: "approved",
        })
      )
      .sort(byDate(-1));
  return out;
}

/* A donation page's sections → what DonationExperience draws: one "why"
   (statement paragraphs, or rich text) and one list of how support helps.
   Disabled blocks are left out. Milestone 7: a statement's own kicker,
   highlight and link, and the cards' highlight, are carried; the kickers
   the page used before are the fallbacks, never an override. */
const whyOf = (sections, kicker) => {
  const s = sections.find((x) => x.enabled && (x.type === "statement" || x.type === "richText"));
  if (!s) return undefined;
  return s.type === "statement"
    ? drop({ id: "why", kicker: s.data.kicker ?? kicker, heading: s.data.heading, highlight: s.data.highlight, body: s.data.body, cta: linkOf(s.data.cta) })
    : { id: "why", kicker, heading: s.data.heading, content: s.data.content };
};
const impactOf = (sections) => {
  const s = sections.find((x) => x.enabled && x.type === "numberedCards");
  return s ? drop({ id: "how-support-helps", kicker: s.data.kicker ?? "How support helps", heading: s.data.heading, highlight: s.data.highlight, intro: s.data.intro, items: s.data.items }) : undefined;
};
/* Milestone 7 — a donation page's trust panel, FAQ and appeal lists. Each
   in one of three states, so a page never loses what the site gave it by
   accident:
     absent (undefined)  the site's own, as before (the transparency panel;
                         the donation FAQs; the page's own appeal bands)
     disabled (null/[])  none on this page — an editor's explicit choice
     present             the page's own wording. A trust panel's document
                         rows stay the transparency records'; an appeal
                         list's appeals are the published appeals of its
                         kind (or all). */
const sectionOf = (sections, type) => sections.find((x) => x.type === type);
const trustOf = (sections) => {
  const s = sectionOf(sections, "trust");
  if (!s) return undefined;
  return s.enabled ? drop({ kicker: s.data.kicker, heading: s.data.heading, highlight: s.data.highlight, body: s.data.body, cta: linkOf(s.data.cta) }) : null;
};
const faqOf = (sections) => {
  const s = sectionOf(sections, "faq");
  if (!s) return undefined;
  return s.enabled ? drop({ kicker: s.data.kicker, heading: s.data.heading, highlight: s.data.highlight, items: s.data.items.map((i) => ({ q: i.question, a: i.answer })) }) : null;
};
const listsOf = (sections) => {
  const lists = sections.filter((x) => x.type === "appealList");
  if (!lists.length) return undefined;
  return lists.filter((x) => x.enabled).map((x) => drop({ id: x.id, kicker: x.data.kicker, heading: x.data.heading, highlight: x.data.highlight, kind: x.data.kind && VIEW_KIND[x.data.kind], cta: linkOf(x.data.cta) }));
};
const checkoutOf = (donation) => {
  const c = donation?.checkout;
  return c ? drop({ provider: c.provider, widgetType: c.widgetType, widgetId: c.widgetId, amount: c.defaultAmount, frequency: c.defaultFrequency }) : undefined;
};
const VIEW_KIND = { emergency: "emergency", campaign: "campaigns" };
const APPEAL_VIEW_SECTIONS = new Set(["statement", "richText", "numberedCards"]);

/* Published appeals → the APPEALS view models (src/contract/appeals.js
   documents the shape), newest first. A CMS appeal's description is its
   SEO description, or its summary. */
export function appealsFrom(snapshot) {
  const appeals = snapshot.content?.appeals;
  if (!appeals) return undefined;
  return [...appeals]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.id.localeCompare(b.id))
    .map((a) =>
      drop({
        id: a.slug,
        kind: VIEW_KIND[a.kind],
        title: a.title,
        status: "published",
        summary: a.summary,
        image: imageOf(snapshot, a.imageId),
        /* The "why" and "how support helps" passages; Milestone 7: with
           their kicker, highlight and link, and `source: "cms"` so the page
           uses the CMS's own headings (content/donation.js appealDonation). */
        source: "cms",
        sections: a.sections
          .filter((s) => s.enabled && APPEAL_VIEW_SECTIONS.has(s.type))
          .map((s) =>
            s.type === "statement"
              ? drop({ id: s.id, type: s.type, kicker: s.data.kicker, heading: s.data.heading, highlight: s.data.highlight, body: s.data.body, cta: linkOf(s.data.cta) })
              : s.type === "richText"
                ? { id: s.id, type: s.type, heading: s.data.heading, content: s.data.content }
                : drop({ id: s.id, type: s.type, kicker: s.data.kicker, heading: s.data.heading, highlight: s.data.highlight, intro: s.data.intro, items: s.data.items.map((i) => i.title), cards: s.data.items })
          ),
        trust: trustOf(a.sections),
        faq: faqOf(a.sections),
        lists: listsOf(a.sections),
        story: a.highlight ? drop({ label: a.highlight.label, image: imageOf(snapshot, a.highlight.imageId) }) : undefined,
        checkout: checkoutOf(a.donation),
        seo: drop({ ...seoOf(snapshot, a.seo), description: a.seo?.description ?? a.summary }),
      })
    );
}

/* The published general donation page → PUBLISHED_GENERAL_DONATION.page. */
export function generalDonationFrom(snapshot) {
  const page = snapshot.content?.generalDonation;
  if (!page || page.status !== "published") return undefined;
  return drop({
    eyebrow: page.hero.eyebrow,
    title: page.hero.title,
    description: page.hero.description,
    image: imageOf(snapshot, page.hero.imageId),
    context: page.hero.context ? drop({ label: page.hero.context.label, body: page.hero.context.body }) : undefined,
    why: whyOf(page.sections, "Why give"),
    impact: impactOf(page.sections),
    trust: trustOf(page.sections),
    faq: faqOf(page.sections),
    lists: listsOf(page.sections),
    designation: page.donation.designation,
    checkout: checkoutOf(page.donation),
    seo: seoOf(snapshot, page.seo),
  });
}

/* The published homepage → PUBLISHED_HOMEPAGE.page: its blocks in order,
   each { id, type, data } with images resolved and references as the
   addresses (slugs) of records the snapshot itself carries — never copies.
   An unknown block type stops the build: there is no generic block. */
const linkOf = (l) => (l ? { label: l.label, to: l.href } : undefined);
const HOMEPAGE_VIEWS = {
  hero: (d, img) => ({ slides: d.slides.map((s) => ({ id: s.id, headline: s.headline, cta: linkOf(s.cta), image: img(s.imageId), inset: img(s.insetId) })), secondary: linkOf(d.secondaryCta), interval: d.intervalMs }),
  imageText: (d, img) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta), secondary: linkOf(d.secondaryCta), image: img(d.imageId), imagePosition: d.imagePosition }),
  /* Milestone 8: the line and link of "programs", "getInvolved",
     "timeline" and "stories" (their SlotHeading `body` and `cta`) are
     carried. NOT carried, on purpose: getInvolved `imageIds` (the band
     draws the ways in as icon boxes, never photographs) and the closing
     cta's `imageId` / `cardImageId` (the homepage's closing band draws
     neither — the source homepage holds both and shows neither). */
  programs: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  approach: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  stats: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, metricIds: d.metricIds, source: d.source, cta: linkOf(d.cta) }),
  timeline: (d, img) =>
    drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta), events: d.items.map((i) => ({ id: i.id, date: i.date, program: i.programId, title: i.title, summary: i.summary, youtubeId: i.youtubeId, videoTitle: i.videoTitle, poster: img(i.posterId) })) }),
  stories: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta), count: d.count }),
  video: (d, img) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, youtubeId: d.youtubeId, title: d.title, poster: img(d.posterId) }),
  trust: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  getInvolved: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  faq: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, items: d.items.map((i) => ({ q: i.question, a: i.answer })) }),
  cta: (d) => drop({ heading: d.heading, highlight: d.highlight, body: d.body, ctas: drop({ primary: linkOf(d.primary), secondary: linkOf(d.secondary) }) }),
  appealList: (d, _img, ref) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, kind: d.kind, cta: linkOf(d.cta), appeals: d.appealIds?.map((id) => ref.appeals(id)) }),
  postList: (d, _img, ref) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, cta: linkOf(d.cta), posts: d.postIds.map((id) => ref.posts(id)) }),
  eventList: (d, _img, ref) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, cta: linkOf(d.cta), events: d.eventIds.map((id) => ref.events(id)) }),
};
export const HOMEPAGE_VIEW_TYPES = Object.keys(HOMEPAGE_VIEWS);

export function homepageFrom(snapshot) {
  const page = snapshot.content?.homepage;
  if (!page || page.status !== "published") return undefined;
  const c = snapshot.content;
  const index = (records, view) => new Map((records ?? []).map((r) => [r.id, view(r)]));
  const posts = new Map([...index(c.news, (p) => ({ collection: "news", slug: p.slug })), ...index(c.blogs, (p) => ({ collection: "blogs", slug: p.slug }))]);
  const events = index(c.events, (e) => e.slug);
  const appeals = index(c.appeals, (a) => a.slug);
  const resolve = (map, kind) => (id) => {
    if (!map.has(id)) throw new Error(`snapshot: the homepage refers to ${kind} "${id}", which the snapshot does not carry`);
    return map.get(id);
  };
  const ref = { posts: resolve(posts, "post"), events: resolve(events, "event"), appeals: resolve(appeals, "appeal") };
  const img = (id) => imageOf(snapshot, id);
  return {
    sections: page.sections
      .filter((s) => s.enabled)
      .map((s) => {
        const view = HOMEPAGE_VIEWS[s.type];
        if (!view) throw new Error(`snapshot: the homepage has a "${s.type}" block, which this site cannot draw`);
        return { id: s.id, type: s.type, data: view(s.data, img, ref) };
      }),
    seo: page.seo ? drop({ title: page.seo.title, description: page.seo.description, image: img(page.seo.ogImageId)?.src, imageAlt: img(page.seo.ogImageId)?.alt, noIndex: page.seo.noIndex }) : undefined,
  };
}

/* The published About page → PUBLISHED_ABOUT.page: its blocks in order,
   each { id, type, data } shaped for the components pages/About uses. An
   unknown block type stops the build. */
const ABOUT_VIEWS = {
  pageHero: (d) => drop({ title: d.title, crumb: d.crumb, body: d.body, cta: linkOf(d.cta) }),
  /* Milestone 8: a statement's link, mission and vision's highlight and
     the values' intro are carried. */
  statement: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  missionVision: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, mission: d.mission, vision: d.vision, source: d.source }),
  numberedCards: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, intro: d.intro, items: d.items }),
  approach: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, intro: d.body, cta: linkOf(d.cta) }),
  transparency: () => ({}),
  cta: (d, img) => drop({ heading: d.heading, highlight: d.highlight, body: d.body, ctas: drop({ primary: linkOf(d.primary), secondary: linkOf(d.secondary) }), image: img(d.imageId) }),
};
export const ABOUT_VIEW_TYPES = Object.keys(ABOUT_VIEWS);

export function aboutFrom(snapshot) {
  const page = snapshot.content?.about;
  if (!page || page.status !== "published") return undefined;
  const img = (id) => imageOf(snapshot, id);
  return {
    sections: page.sections
      .filter((s) => s.enabled)
      .map((s) => {
        const view = ABOUT_VIEWS[s.type];
        if (!view) throw new Error(`snapshot: the About page has a "${s.type}" block, which this site cannot draw`);
        return { id: s.id, type: s.type, data: view(s.data, img) };
      }),
    seo: page.seo ? drop({ title: page.seo.title, description: page.seo.description, image: img(page.seo.ogImageId)?.src, imageAlt: img(page.seo.ogImageId)?.alt, noIndex: page.seo.noIndex }) : undefined,
  };
}

/* Published team members → TEAM_MEMBERS, in the shape content/team.js
   already uses (so the team page, the profiles, their routes and SEO work
   unchanged), in team order. `status: "approved"` is the site's word for
   a record that may be shown; the group is the site's `category`. */
export function teamFrom(snapshot) {
  const team = snapshot.content?.team;
  if (!team) return undefined;
  return [...team]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((m) => {
      const image = imageOf(snapshot, m.imageId);
      return drop({
        id: m.id,
        slug: m.slug,
        name: m.name,
        role: m.role,
        status: "approved",
        category: m.group,
        order: m.order,
        featured: m.featured,
        shortBio: m.shortBio,
        biography: m.biography,
        image: image?.src,
        imageAlt: image?.alt,
        imageId: image?.mediaId,
        departmentOrArea: m.departmentOrArea,
        location: m.location,
        socialLinks: m.socialLinks,
        relatedLinks: m.relatedLinks?.map((l) => ({ label: l.label, to: l.href })),
      });
    });
}

/* Published programs → PROGRAMS, in the shape content/work.js already
   uses (so the program pages, /work, the menu, the homepage's cards and
   every reference keep working unchanged), in order. */
export function programsFrom(snapshot) {
  const programs = snapshot.content?.programs;
  if (!programs) return undefined;
  return [...programs]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((p) =>
      drop({
        slug: p.slug,
        title: p.title,
        to: `/work/${p.slug}`,
        icon: p.icon,
        description: p.description,
        missing: p.missingNote,
        why: p.why,
        activities: p.activities,
        impact: p.impact,
        stories: p.stories,
        seo: p.seo ? drop({ title: p.seo.title, description: p.seo.description, image: imageOf(snapshot, p.seo.ogImageId)?.src, imageAlt: imageOf(snapshot, p.seo.ogImageId)?.alt, noIndex: p.seo.noIndex }) : undefined,
      })
    );
}

/* Published projects → PROJECT_RECORDS and PROJECTS, in the shape
   content/work.js uses (so /work/projects, the project pages, the program
   pages, the featured projects and the timeline work unchanged), in
   order. "approved" is the site's word for a record that may be shown. */
const seoView = (snapshot, seo) => (seo ? drop({ title: seo.title, description: seo.description, image: imageOf(snapshot, seo.ogImageId)?.src, imageAlt: imageOf(snapshot, seo.ogImageId)?.alt, noIndex: seo.noIndex }) : undefined);
export function projectsFrom(snapshot) {
  const projects = snapshot.content?.projects;
  if (!projects) return undefined;
  return [...projects]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((p) =>
      drop({
        id: p.id,
        editorialStatus: "approved",
        slug: p.slug,
        title: p.title,
        program: p.programId,
        description: p.description,
        image: imageOf(snapshot, p.imageId),
        context: p.context,
        activities: p.activities,
        approach: p.approach,
        outcomes: p.outcomes,
        /* Milestone 6, in the source shape: the stage is the source's
           `status` (the project's own stage, never its editorial status);
           the story is named by id and resolved on the page
           (lib/projectStory.js), its title and excerpt the story's own. */
        location: p.location,
        status: p.stage,
        date: p.date,
        impact: p.impact?.map((m) => ({ value: m.value, label: m.label })),
        partners: p.partners,
        storyId: p.storyId,
        featured: p.featured,
        seo: seoView(snapshot, p.seo),
      })
    );
}

/* Published stories → STORIES, in the shape content/stories.js uses (the
   hub, the story pages, the homepage's newest stories, /impact, related
   stories), in the snapshot's order (newest first, then as added). The
   body stays structured rich text (pages render it with
   components/RichText); related stories become their addresses. */
export function storiesFrom(snapshot) {
  const stories = snapshot.content?.stories;
  if (!stories) return undefined;
  const slugOf = new Map(stories.map((s) => [s.id, s.slug]));
  return stories.map((s) =>
    drop({
      id: s.id,
      slug: s.slug,
      title: s.title,
      status: "approved",
      category: s.category,
      excerpt: s.excerpt,
      date: s.date,
      author: s.author,
      featured: s.featured,
      image: imageOf(snapshot, s.imageId),
      body: s.body,
      location: s.location,
      programId: s.programId,
      projectId: s.projectId,
      media: s.galleryIds?.map((id) => imageOf(snapshot, id)),
      /* Milestone 5: the source shape exactly — quotes { text, attribution? }
         (pull-quotes after the body) and impact lines (the Impact row). */
      quotes: s.quotes?.map((q) => drop({ text: q.text, attribution: q.attribution })),
      impact: s.impact,
      relatedStoryIds: s.relatedPostIds?.map((id) => {
        if (!slugOf.has(id)) throw new Error(`snapshot: story "${s.slug}" relates to story "${id}", which the snapshot does not carry`);
        return slugOf.get(id);
      }),
      seo: seoView(snapshot, s.seo),
    })
  );
}

/* The published Careers page → CAREERS, in the shape content/contact.js
   uses (so pages/Careers, its SEO and its validation work unchanged). A
   section the record leaves out is left out of the page; the open roles
   are the record's, in order ("verified" is the site's word for a role
   that may be shown — and, as before, the page is indexed only with one).
   Without its own SEO description the page falls back to the site's. */
export function careersFrom(snapshot) {
  const c = snapshot.content?.careers;
  if (!c || c.status !== "published") return undefined;
  const section = (id, s) => s && { id, heading: s.heading, body: s.body };
  return drop({
    title: c.title,
    kicker: c.kicker ?? null,
    body: c.intro,
    metaDescription: c.seo?.description ?? null,
    seoTitle: c.seo?.title ?? null,
    noIndex: c.seo?.noIndex ?? false,
    sections: [section("why", c.why), { id: "opportunities", heading: c.opportunities.heading, empty: c.opportunities.empty }, section("apply", c.apply)].filter(Boolean),
    roles: c.opportunities.roles.map((r) => ({ title: r.title, status: "verified" })),
    closing: { heading: c.closing.heading, ctas: drop({ primary: linkOf(c.closing.primary), secondary: linkOf(c.closing.secondary) }) },
  });
}

/* Published policies (M19) → their records in POLICIES
   (content/policies.js), merged BY ID into the very objects the site
   already uses, so policies.js itself is untouched — and a build without
   a published policy is byte for byte what it was. Every field the page,
   the footer, the forms and SEO read is set, so nothing of the source
   record's working text survives: `status: "approved"` is the site's word
   for a published policy; no contact clears the source's; without its
   own SEO description the page keeps the site's. The id and the route
   stay the site's.

   A CMS policy is FINAL — RBB's approved text — and the site tells final
   from working text by its markers (lib/releaseMarkers.js, isFinalPolicy).
   So text that carries a working-placeholder marker fails the build
   rather than being shown as RBB's policy, or silently as pending. So
   does a policy id the site has no page for (a newer API than this site). */
export const POLICY_IDS = ["privacy", "terms", "donation"];
export function policiesFrom(snapshot) {
  const policies = snapshot.content?.policies;
  if (!policies) return undefined;
  if (!Array.isArray(policies)) throw new Error("snapshot: content.policies must be a list of policies");
  const byId = {};
  for (const p of policies) {
    if (!POLICY_IDS.includes(p?.id)) throw new Error(`snapshot: content.policies has a policy "${p?.id}" this site has no page for (it knows ${POLICY_IDS.join(", ")}) — update scripts/snapshot-adapter.mjs`);
    if (byId[p.id]) throw new Error(`snapshot: content.policies has "${p.id}" twice`);
    if (p.status !== "published") throw new Error(`snapshot: policy "${p.id}" is not published`);
    if (!Array.isArray(p.sections) || !p.sections.length || !p.effectiveDate || !p.lastUpdated) throw new Error(`snapshot: policy "${p.id}" needs both dates and at least one section`);
    const findings = workingContentFindings([p.intro, p.sections]);
    if (findings.length) throw new Error(`snapshot: policy "${p.id}" contains working-placeholder text (${findings.join(", ")}) — a published policy must be RBB's final text; correct it in the CMS and publish again`);
    byId[p.id] = {
      title: p.title,
      status: "approved",
      effectiveDate: p.effectiveDate,
      lastUpdated: p.lastUpdated,
      intro: p.intro ?? [],
      sections: p.sections.map((s) => drop({ id: s.id, heading: s.heading, body: s.body, items: s.items?.length ? s.items : undefined })),
      contactReference: p.contactReference ?? null,
      relatedPolicies: p.relatedPolicies ?? [],
      ...(p.seo?.description && { metaDescription: p.seo.description }),
    };
  }
  return byId;
}

/* Published Get Involved pages (M20) → the words of GET_INVOLVED and
   GET_INVOLVED_PAGES (content/getInvolved.js), assigned to the very
   objects the site already reads, so getInvolved.js is untouched and a
   build without a published page is byte for byte what it was. Nested
   targets: a key "A.b.c" assigns to that object inside export A.

   A path: its card/page line, its sections (the source ones are replaced
   whole; an FAQ becomes the section with `faqs` the page draws on its
   ink band), its meta description when it has one, and its line in the
   hub's list. The hub: its heading and introduction, and — each only when
   the record has it — the two path sections' headings, "Why get involved"
   (absent: the mission paragraph stays) and the closing, whose calls to
   action name a TARGET this file maps to a route. Everything else stays
   the site's. Like the policies, a page that is not published, not
   complete, of an unknown id, with an unknown target, or carrying
   working-placeholder text fails the build. */
export const GET_INVOLVED_IDS = ["hub", "volunteer", "fellowship", "partner", "travel"];
export const CTA_ROUTES = { appeals: "/appeals", work: "/work", impact: "/impact", contact: "/contact", "get-involved": "/get-involved", about: "/about" };
export function getInvolvedFrom(snapshot) {
  const pages = snapshot.content?.getInvolved;
  if (!pages) return undefined;
  if (!Array.isArray(pages)) throw new Error("snapshot: content.getInvolved must be a list of pages");
  const seen = new Set();
  const out = {};
  const paths = {};
  const notes = {};
  const cta = (c, where) => {
    if (!c) return undefined;
    const to = CTA_ROUTES[c.target];
    if (!to) throw new Error(`snapshot: Get Involved ${where} names the target "${c.target}", which this site has no route for (it knows ${Object.keys(CTA_ROUTES).join(", ")})`);
    return { label: c.label, to };
  };
  for (const p of pages) {
    if (!GET_INVOLVED_IDS.includes(p?.id)) throw new Error(`snapshot: content.getInvolved has a page "${p?.id}" this site has no page for (it knows ${GET_INVOLVED_IDS.join(", ")}) — update scripts/snapshot-adapter.mjs`);
    if (seen.has(p.id)) throw new Error(`snapshot: content.getInvolved has "${p.id}" twice`);
    seen.add(p.id);
    if (p.status !== "published") throw new Error(`snapshot: Get Involved page "${p.id}" is not published`);
    const findings = workingContentFindings(p);
    if (findings.length) throw new Error(`snapshot: Get Involved page "${p.id}" contains working-placeholder text (${findings.join(", ")}) — a published page must be RBB's own text; correct it in the CMS and publish again`);
    if (p.id === "hub") {
      if (!p.heading || !p.intro) throw new Error('snapshot: Get Involved page "hub" needs its heading and introduction');
      out["GET_INVOLVED_PAGES.hub"] = { heading: p.heading, body: p.intro };
      if (p.ways) out["GET_INVOLVED_PAGES.hub.ways"] = { kicker: p.ways.kicker, heading: p.ways.heading };
      if (p.choose) out["GET_INVOLVED_PAGES.hub.choose"] = { kicker: p.choose.kicker, heading: p.choose.heading };
      if (p.why) out["GET_INVOLVED_PAGES.hub.why"] = { heading: p.why.heading, body: p.why.body };
      if (p.closing) out["GET_INVOLVED_PAGES.hub.closing"] = { heading: p.closing.heading, ctas: drop({ primary: cta(p.closing.primary, "hub closing"), secondary: cta(p.closing.secondary, "hub closing") }) };
      continue;
    }
    if (!p.shortDescription || !Array.isArray(p.sections) || !p.sections.length) throw new Error(`snapshot: Get Involved page "${p.id}" needs its short description and at least one section`);
    paths[p.id] = {
      shortDescription: p.shortDescription,
      ...(p.seo?.description && { metaDescription: p.seo.description }),
      sections: [
        ...p.sections.map((s) => drop({ id: s.id, heading: s.heading, body: s.body, items: s.items?.length ? s.items : undefined })),
        ...(p.faq ? [{ id: "faq", heading: p.faq.heading, faqs: p.faq.items.map((f) => ({ q: f.question, a: f.answer })) }] : []),
      ],
    };
    if (p.hubNote) notes[p.id] = p.hubNote;
  }
  if (Object.keys(paths).length) out["GET_INVOLVED.paths"] = { [BY_ID]: paths };
  if (Object.keys(notes).length) out["GET_INVOLVED_PAGES.hub.choose.notes"] = notes;
  return out;
}

/* The announcement bar (M21) → ANNOUNCEMENTS.bar (content/announcements.js),
   assigned in place, so the bar, config/sections.js and the release
   checks read it as before:
     enabled, interval   the published settings' engagement.announcementBar
                         — in every build with a snapshot
     items               the published bar's messages, in order — only
                         while the bar is published; otherwise the site's
                         own messages stay
   A message links with the site's router: its href must be a path here,
   and content/validate.js fails the build unless it is one of the
   site's pages. An unpublished or empty bar, or working-placeholder text,
   fails the build. */
export function announcementsFrom(snapshot) {
  const engagement = snapshot.settings?.engagement?.announcementBar;
  const bar = snapshot.content?.announcementBar;
  const out = {};
  if (engagement) Object.assign(out, { enabled: engagement.enabled, interval: engagement.intervalMs });
  if (bar) {
    if (bar.status !== "published") throw new Error("snapshot: the announcement bar is not published");
    if (!Array.isArray(bar.items) || !bar.items.length) throw new Error("snapshot: the announcement bar needs at least one message");
    const findings = workingContentFindings(bar.items);
    if (findings.length) throw new Error(`snapshot: the announcement bar contains working-placeholder text (${findings.join(", ")}) — correct it in the CMS and publish again`);
    out.items = bar.items.map((item) => {
      if (item.link && !/^\/(?!\/)[^\s?#\\]*$/.test(item.link.href)) throw new Error(`snapshot: announcement "${item.id}" links to "${item.link.href}", which is not a path on this site`);
      return drop({ id: item.id, text: item.text, link: item.link && { label: item.link.label, to: item.link.href } });
    });
  }
  return Object.keys(out).length ? { "ANNOUNCEMENTS.bar": out } : undefined;
}

/* The site popup (M22) → ANNOUNCEMENTS.popup (content/announcements.js),
   assigned in place:
     enabled    the published settings' engagement.popup — in every build
                with a snapshot
     the rest   the published popup — only while it is published; its
                `key` becomes the popup's `id`, what a visitor's "closed"
                is remembered against. A part it leaves out (kicker,
                highlight) is cleared, never left as the site's sample.
                Its photograph is the media library's
   Its `close` label stays the site's. The call to action is drawn with
   the router: a path here, which content/validate.js checks is a page.
   An unpublished popup, one the site cannot draw (a page allow-list or a
   time window), a photograph missing from the snapshot, or working
   placeholder text fails the build. */
const SITE_PATH = /^\/(?!\/)[^\s?#\\]*$/;
export function popupFrom(snapshot) {
  const engagement = snapshot.settings?.engagement?.popup;
  const p = snapshot.content?.popup;
  const out = {};
  if (engagement) out.enabled = engagement.enabled;
  if (p) {
    if (p.status !== "published") throw new Error("snapshot: the popup is not published");
    for (const field of ["includePaths", "startsAt", "endsAt"]) if (p[field] !== undefined) throw new Error(`snapshot: the popup sets "${field}", which this site's popup cannot honour`);
    if (!SITE_PATH.test(p.cta?.href ?? "")) throw new Error(`snapshot: the popup's call to action leads to "${p.cta?.href}", which is not a path on this site`);
    const image = imageOf(snapshot, p.imageId);
    if (!image) throw new Error(`snapshot: the popup's photograph "${p.imageId}" is not in the snapshot's media`);
    const findings = workingContentFindings([p.kicker, p.heading, p.highlight, p.body, p.cta.label, p.dismissLabel]);
    if (findings.length) throw new Error(`snapshot: the popup contains working-placeholder text (${findings.join(", ")}) — correct it in the CMS and publish again`);
    Object.assign(out, {
      id: p.key,
      kicker: p.kicker ?? null,
      heading: p.heading,
      highlight: p.highlight ?? null,
      body: p.body,
      image,
      cta: { label: p.cta.label, to: p.cta.href },
      dismiss: p.dismissLabel,
      delayMs: p.delayMs,
      frequency: p.frequency,
      excludePaths: p.excludePaths,
      releaseMarker: null,
    });
  }
  return Object.keys(out).length ? { "ANNOUNCEMENTS.popup": out } : undefined;
}

/* Highlights — the story strip (M23). A published strip names appeals by
   record id; the site knows them by address (their slug, the view's id).
   It decides which appeals and in what order: the strip's appeals each
   get a `story` (their own highlight, or {} — their title and photo). */
export function storyStripFrom(snapshot) {
  const strip = snapshot.content?.storyStrip;
  if (!strip) return undefined;
  if (strip.status !== "published") throw new Error("snapshot: Highlights (the story strip) are not published");
  if (!Array.isArray(strip.appealIds) || !strip.appealIds.length) throw new Error("snapshot: Highlights (the story strip) need at least one appeal");
  const slugById = new Map((snapshot.content.appeals ?? []).filter((a) => a.status === "published").map((a) => [a.id, a.slug]));
  return strip.appealIds.map((id) => {
    const slug = slugById.get(id);
    if (!slug) throw new Error(`snapshot: Highlights name appeal "${id}", which is not published in this snapshot`);
    return slug;
  });
}

/* The one expression a published strip rewrites in content/appeals.js:
   `storyAppeals` takes the strip's appeals in the strip's order instead of
   the highlighted appeals in list order — leaving the appeal lists' own
   order alone. Applied ONLY to builds with a published strip (so every
   other build is byte for byte what it was), and the build fails unless
   the expression is found exactly once. */
export const STORY_REWRITE = {
  file: "src/content/appeals.js",
  find: "APPEALS.filter((a) => a.story)",
  replace: "APPEAL_STORIES.order.map((id) => APPEALS.find((a) => a.id === id)).filter((a) => a?.story)",
};
export const rewritesFrom = (snapshot) => (storyStripFrom(snapshot) ? { [STORY_REWRITE.file]: [{ find: STORY_REWRITE.find, replace: STORY_REWRITE.replace }] } : {});

/* Source rewrites, each found exactly once — or the build fails. */
export function applyRewrites(code, file, rewrites = []) {
  return rewrites.reduce((out, { find, replace }) => {
    const count = out.split(find).length - 1;
    if (count !== 1) throw new Error(`${file}: expected "${find}" exactly once, found it ${count} times — update scripts/snapshot-adapter.mjs`);
    return out.replace(find, () => replace);
  }, code);
}

/* Published figures → IMPACT.metrics, in the shape content/impact.js
   uses: the figure's key is the id `stats` blocks name; its verification
   is the site's status (an unverified figure does not count up). */
export function metricsFrom(snapshot) {
  const metrics = snapshot.content?.metrics;
  if (!metrics) return undefined;
  return [...metrics]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((m) => ({ id: m.slug, value: m.value, label: m.label, status: m.verification === "verified" ? "verified" : "pending-review" }));
}

/* The published Impact page → PUBLISHED_IMPACT.page: its blocks in order,
   each { id, type, data } shaped for the components pages/Impact uses.
   Figures, programs and stories stay NAMES (CmsImpact resolves them). An
   unknown block type stops the build. */
const teaserOf = (d) => drop({ kicker: d.kicker, heading: d.heading, body: d.body, cta: linkOf(d.cta) });
const IMPACT_VIEWS = {
  intro: (d) => drop({ kicker: d.kicker, title: d.title, highlight: d.highlight, body: d.body }),
  stats: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, metricIds: d.metricIds, source: d.source, cta: linkOf(d.cta) }),
  programImpact: (d) => drop({ kicker: d.kicker, heading: d.heading, items: d.items }),
  teasers: (d) => ({ first: teaserOf(d.items[0]), second: teaserOf(d.items[1]) }),
  measurement: (d) => drop({ heading: d.heading, body: d.body, items: d.items }),
  stories: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, storyIds: d.storyIds, cta: linkOf(d.cta) }),
  trust: (d) => drop({ kicker: d.kicker, heading: d.heading, highlight: d.highlight, body: d.body, cta: linkOf(d.cta) }),
  cta: (d, img) => drop({ heading: d.heading, highlight: d.highlight, body: d.body, ctas: drop({ primary: linkOf(d.primary), secondary: linkOf(d.secondary) }), image: img(d.imageId) }),
};
export const IMPACT_VIEW_TYPES = Object.keys(IMPACT_VIEWS);

export function impactFrom(snapshot) {
  const page = snapshot.content?.impact;
  if (!page || page.status !== "published") return undefined;
  const img = (id) => imageOf(snapshot, id);
  return {
    sections: page.sections
      .filter((s) => s.enabled)
      .map((s) => {
        const view = IMPACT_VIEWS[s.type];
        if (!view) throw new Error(`snapshot: the Impact page has a "${s.type}" block, which this site cannot draw`);
        return { id: s.id, type: s.type, data: view(s.data, img) };
      }),
    seo: page.seo ? drop({ title: page.seo.title, description: page.seo.description, image: img(page.seo.ogImageId)?.src, imageAlt: img(page.seo.ogImageId)?.alt, noIndex: page.seo.noIndex }) : undefined,
  };
}

/* The published Transparency record and documents → the values
   content/transparency.js holds, in its own shape (so TransparencySection
   and every trust panel work unchanged). Published by an owner means
   approved ("verified"); the figures keep their own verification. Each
   part only when the snapshot carries it: the record and the documents
   are separate (TRANSPARENCY_COPY's chapter words with the record). */
const REPORT_LISTS = { annualReport: "annualReports", financial: "financialDocuments", governance: "governanceDocuments" };
export function transparencyFrom(snapshot) {
  const t = snapshot.content?.transparency;
  const reports = snapshot.content?.reports;
  if (!t && !reports) return undefined;
  const TRANSPARENCY = {};
  if (t) {
    const status = t.financialOverview.verification === "verified" ? "verified" : "pending-review";
    TRANSPARENCY.financialOverview = { year: t.financialOverview.year, status, items: t.financialOverview.items.map((i) => ({ id: i.id, label: i.label, percentage: i.percentage, status })) };
    TRANSPARENCY.governance = t.governance ? { intro: t.governance.intro ?? null, sections: t.governance.sections ?? [], status: "verified" } : { intro: null, sections: [], status: "placeholder" };
    TRANSPARENCY.accountability = t.accountability ? { intro: t.accountability, status: "verified" } : { intro: null, status: "placeholder" };
  }
  if (reports) {
    const sorted = [...reports].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    for (const [category, list] of Object.entries(REPORT_LISTS))
      TRANSPARENCY[list] = sorted.filter((r) => r.category === category).map((r) => drop({ id: r.slug, title: r.title, year: r.year, type: r.type, fileUrl: r.fileUrl, status: "verified" }));
  }
  return { TRANSPARENCY, ...(t && { TRANSPARENCY_COPY: { kicker: t.kicker ?? null, heading: t.heading, body: t.intro } }) };
}

/* Every origin the published content's images load from — added to the
   page policy (img-src) and to the build's approved third-party list
   only when a snapshot actually brings such images. */
export function imageOrigins(snapshot) {
  const page = generalDonationFrom(snapshot);
  const views = [...Object.values(collectionsFrom(snapshot)).flat(), ...(appealsFrom(snapshot) ?? []), ...(page ? [page] : [])];
  const home = homepageFrom(snapshot);
  const homeImages = JSON.stringify(home ?? {}).match(/"src":"[^"]+"/g)?.map((m) => m.slice(7, -1)) ?? [];
  const about = aboutFrom(snapshot);
  const aboutImages = JSON.stringify(about ?? {}).match(/"src":"[^"]+"/g)?.map((m) => m.slice(7, -1)) ?? [];
  const team = (teamFrom(snapshot) ?? []).map((m) => m.image);
  const programImages = (programsFrom(snapshot) ?? []).map((p) => p.seo?.image);
  const impact = impactFrom(snapshot);
  const impactImages = JSON.stringify(impact ?? {}).match(/"src":"[^"]+"/g)?.map((m) => m.slice(7, -1)) ?? [];
  const storyImages = (storiesFrom(snapshot) ?? []).flatMap((s) => [s.image?.src, ...(s.media ?? []).map((m) => m.src), s.seo?.image]);
  const projectImages = (projectsFrom(snapshot) ?? []).flatMap((p) => [p.image?.src, p.seo?.image]);
  const popupImage = snapshot.content?.popup && imageOf(snapshot, snapshot.content.popup.imageId)?.src;
  const sources = [popupImage, ...views.flatMap((v) => [v.image?.src, v.story?.image?.src]), ...homeImages, home?.seo?.image, ...aboutImages, about?.seo?.image, ...team, ...programImages, ...impactImages, impact?.seo?.image, ...storyImages, ...projectImages];
  return [...new Set(sources.filter(Boolean).map((src) => new URL(src).origin))].sort();
}

/* Whether the published content asks for a provider checkout anywhere. */
export const hasCheckouts = (snapshot) => Boolean(generalDonationFrom(snapshot)?.checkout || appealsFrom(snapshot)?.some((a) => a.checkout));

const nullable = (value) => (value === undefined ? null : value);

/* content/appeals.js: the published appeals; the story strip's order and
   its appeals' circles (M23); the strip's switch in every snapshot build. */
function appealsOverrides(snapshot) {
  const appeals = appealsFrom(snapshot);
  const order = storyStripFrom(snapshot);
  const engagement = snapshot.settings?.engagement?.storyStrip;
  const stories = engagement || order ? { ...(engagement && { enabled: engagement.enabled }), ...(order && { order }) } : undefined;
  const listed = new Set(order ?? []);
  const views = appeals && order ? appeals.map((a) => (listed.has(a.id) ? { ...a, story: a.story ?? {} } : a)) : appeals;
  if (!views && !stories) return {};
  return { "src/content/appeals.js": { ...(views && { APPEALS: views }), ...(stories && { APPEAL_STORIES: stories }) } };
}

/* The values to assign, per file and export. Pure; JSON in, JSON out. */
export function overridesFrom(snapshot) {
  const s = snapshot.settings;
  const office = s.contact.office;
  return {
    "src/content/brand.js": { BRAND: { name: s.general.shortName, fullName: s.general.name, summary: s.general.summary } },
    /* Milestone 3: the site-wide default share image, for pages without their own. */
    "src/content/site.js": { SITE: drop({ description: s.seo.description, shareImage: (({ src, alt } = {}) => (src ? { src, alt } : undefined))(imageOf(snapshot, s.seo.ogImageId)) }) },
    "src/content/contact.js": {
      ORG_CONTACT: {
        methods: s.contact.methods.map((m) => ({ ...m, status: "verified" })),
        office: office
          ? { address: office.address, city: nullable(office.city), region: nullable(office.region), country: nullable(office.country), mapUrl: nullable(office.mapUrl), status: "verified" }
          : { address: null, city: null, region: null, country: null, mapUrl: null, status: "placeholder" },
        hours: s.contact.hours ? { value: s.contact.hours, status: "verified" } : { value: null, status: "placeholder" },
        responseTime: s.contact.responseTime ? { value: s.contact.responseTime, status: "verified" } : { value: null, status: "placeholder" },
        social: s.social.map(({ platform, url }) => {
          if (!SOCIAL_LABELS[platform]) throw new Error(`snapshot: the site has no icon for the social platform "${platform}"`);
          return { platform, icon: platform, label: SOCIAL_LABELS[platform], url, status: "verified" };
        }),
      },
      ...(careersFrom(snapshot) && { CAREERS: careersFrom(snapshot) }),
    },
    ...(Object.keys(collectionsFrom(snapshot)).length && { "src/content/media.js": collectionsFrom(snapshot) }),
    ...appealsOverrides(snapshot),
    ...(generalDonationFrom(snapshot) && { "src/content/donation.js": { PUBLISHED_GENERAL_DONATION: { page: generalDonationFrom(snapshot) } } }),
    ...(homepageFrom(snapshot) && { "src/content/homepage.js": { PUBLISHED_HOMEPAGE: { page: homepageFrom(snapshot) } } }),
    ...(aboutFrom(snapshot) && { "src/content/about.js": { PUBLISHED_ABOUT: { page: aboutFrom(snapshot) } } }),
    ...(teamFrom(snapshot) && { "src/content/team.js": { TEAM_MEMBERS: teamFrom(snapshot) } }),
    ...((programsFrom(snapshot) || projectsFrom(snapshot)) && {
      "src/content/work.js": {
        ...(programsFrom(snapshot) && { PROGRAMS: programsFrom(snapshot) }),
        ...(projectsFrom(snapshot) && { PROJECT_RECORDS: projectsFrom(snapshot), PROJECTS: projectsFrom(snapshot), PROJECT_SOURCE: { cms: true } }),
      },
    }),
    ...(storiesFrom(snapshot) && { "src/content/stories.js": { STORIES: storiesFrom(snapshot), STORY_SOURCE: { cms: true } } }),
    ...((metricsFrom(snapshot) || impactFrom(snapshot)) && {
      "src/content/impact.js": {
        ...(metricsFrom(snapshot) && { IMPACT: { metrics: metricsFrom(snapshot) } }),
        ...(impactFrom(snapshot) && { PUBLISHED_IMPACT: { page: impactFrom(snapshot) } }),
      },
    }),
    ...(transparencyFrom(snapshot) && { "src/content/transparency.js": transparencyFrom(snapshot) }),
    ...(policiesFrom(snapshot) && { "src/content/policies.js": { POLICIES: { [BY_ID]: policiesFrom(snapshot) } } }),
    ...(getInvolvedFrom(snapshot) && { "src/content/getInvolved.js": getInvolvedFrom(snapshot) }),
    ...((announcementsFrom(snapshot) || popupFrom(snapshot)) && { "src/content/announcements.js": { ...announcementsFrom(snapshot), ...popupFrom(snapshot) } }),
  };
}

/* A value for a collection whose records are merged BY ID rather than
   replaced: { [BY_ID]: { <id>: fields } } (the policies, M19). */
export const BY_ID = "$byId";

/* The code appended to a target module: assignments to its own export,
   run when the module finishes loading. A name may reach inside the
   export — "GET_INVOLVED_PAGES.hub.choose" assigns to that object (M20).
   Fails if the module no longer declares the export (the mapping would
   otherwise silently do nothing), if a nested target is not an object
   there, or — merging by id — if no record has that id. */
export function appendOverrides(code, file, overrides) {
  const assignments = Object.entries(overrides).map(([name, values]) => {
    const [root, ...rest] = name.split(".");
    if (!/^[A-Z_][A-Z0-9_]*$/.test(root) || rest.some((key) => !/^[A-Za-z_]\w*$/.test(key))) throw new Error(`${file}: "${name}" is not a target the snapshot can set`);
    if (!new RegExp(`export const ${root}\\s*=`).test(code)) throw new Error(`${file} no longer declares "export const ${root}" — update scripts/snapshot-adapter.mjs`);
    const missing = (what) => `throw new Error(${JSON.stringify(`${file}: ${name} `)} + ${what} + " — update scripts/snapshot-adapter.mjs")`;
    // A nested target must exist, and be the right kind of value, when the module has loaded.
    const target = rest.length ? `(() => { const t = ${name}; if (t === null || typeof t !== "object" || Array.isArray(t) !== ${Array.isArray(values) || (values !== null && BY_ID in Object(values))}) ${missing('"is not the object the snapshot sets"')}; return t; })()` : name;
    // Each record with an id gains its values, in place; every id must be found.
    if (values && !Array.isArray(values) && BY_ID in values)
      return rest.length
        ? `{ const list = ${target}; const byId = ${JSON.stringify(values[BY_ID])}; for (const [id, v] of Object.entries(byId)) { const record = list.find((r) => r.id === id); if (!record) ${missing('"has no record " + JSON.stringify(id)')}; Object.assign(record, v); } }`
        : `{ const byId = ${JSON.stringify(values[BY_ID])}; for (const [id, v] of Object.entries(byId)) { const record = ${name}.find((r) => r.id === id); if (!record) throw new Error(${JSON.stringify(`${file}: ${name} has no record `)} + JSON.stringify(id) + " — update scripts/snapshot-adapter.mjs"); Object.assign(record, v); } }`;
    // An object gains the values; a collection's contents are replaced.
    if (rest.length) return Array.isArray(values) ? `{ const list = ${target}; list.splice(0, list.length, ...${JSON.stringify(values)}); }` : `Object.assign(${target}, ${JSON.stringify(values)});`;
    return Array.isArray(values) ? `${name}.splice(0, ${name}.length, ...${JSON.stringify(values)});` : `Object.assign(${name}, ${JSON.stringify(values)});`;
  });
  return `${code}\n/* Set from the published snapshot (scripts/snapshot-adapter.mjs). */\n${assignments.join("\n")}\n`;
}

/* The minimum a snapshot must be before a build will use it. The full
   content-contract check runs inside the server build (entry-server
   publishedSnapshotProblems), which fails the build on any problem. */
export function structuralProblems(snapshot, { orgId, minimumVersion = 0 }) {
  const problems = [];
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!object(snapshot)) return ["the response is not a snapshot object"];
  if (!Number.isInteger(snapshot.version) || snapshot.version < 1) problems.push("version must be a positive integer");
  if (snapshot.schemaVersion !== 1) problems.push(`schemaVersion ${JSON.stringify(snapshot.schemaVersion)} is not one this site understands (1)`);
  if (snapshot.organization?.id !== orgId) problems.push(`the snapshot is for another organization (expected "${orgId}")`);
  if (!object(snapshot.settings)) problems.push("settings are missing");
  else for (const key of ["general", "contact", "seo"]) if (!object(snapshot.settings[key])) problems.push(`settings.${key} is missing`);
  if (object(snapshot.settings) && !Array.isArray(snapshot.settings.social)) problems.push("settings.social is missing");
  if (!object(snapshot.media) || !object(snapshot.content)) problems.push("media/content are missing");
  if (minimumVersion && snapshot.version < minimumVersion) problems.push(`version ${snapshot.version} is older than the expected ${minimumVersion}`);
  return problems;
}
