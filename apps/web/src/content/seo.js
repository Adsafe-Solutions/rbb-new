/* SEO, metadata & discoverability — Document 14. ONE source for what
   every route tells search engines and social platforms: title,
   description, canonical URL, robots, Open Graph / X cards and structured
   data. hooks/useSeo.js writes it into <head>; the build writes
   sitemap.xml and robots.txt from it (vite.config.js).

   Every value is DERIVED from the content the page itself renders. This
   file is not a second place to state facts: nothing here may add a
   statistic, country, beneficiary, partner, legal or tax status, award,
   founding date, donation outcome or promotional descriptor ("leading",
   "trusted", …) that the page does not already show as approved.

   ⚠ Descriptions never quote placeholder copy ("to be provided"). A page
   that is still mostly pending gets a neutral line saying what the page
   is FOR, and is kept out of the index until it has content.

   ⚠ Absolute URLs — canonicals, og:url, images, structured data, the
   sitemap — exist only once ENV.siteOrigin is a verified production
   origin (config/env.js). Until then they are omitted, never guessed.

   One route's metadata:
     {
       route, canonicalPath,
       title:        the page's own subject; "| Rising Beyond Borders" is
                     added by `documentTitle`
       description,
       robots:       "index, follow" | "noindex, follow"
       ogTitle, ogDescription, ogImage, ogType,
       twitterCard, twitterTitle, twitterDescription, twitterImage,
       schemaType, schemaData,
       status:       "indexable" | "pending" — why robots says what it says
     } */

import { ENV } from "../config/env.js";
import { BRAND } from "./brand.js";
import { SITE } from "./site.js";
import { PAGES } from "./nav.js";
import { ORG_CONTACT, CAREERS, CONTACT_COPY, verifiedOnly } from "./contact.js";
import { GET_INVOLVED } from "./getInvolved.js";
import { IMPACT, PUBLISHED_IMPACT } from "./impact.js";
import { PROGRAMS, PROJECTS, projectPath } from "./work.js";
import { published, storyPath, categoryById } from "./stories.js";
import { approvedMembers, hasProfile, memberPath } from "./team.js";
import { POLICIES, isFinalPolicy } from "./policies.js";
import { APPEALS, appealPath } from "./appeals.js";
import { PUBLISHED_GENERAL_DONATION } from "./donation.js";
import { PUBLISHED_HOMEPAGE } from "./homepage.js";
import { PUBLISHED_ABOUT } from "./about.js";
import { isWorkingContent } from "../lib/releaseMarkers.js";
import { APPROVALS } from "../../release/approvals.mjs";

const INDEX = "index, follow";
const NOINDEX = "noindex, follow";

/* ---------------- Indexing follows RBB's approval ----------------

   A page may be indexed only when the RBB approval its content depends on
   is recorded as approved in release/approvals.mjs — THE approval record
   (Document 24). The content records' own `status: "approved"` does not
   mean that: working placeholders carry it so the whole site renders for
   review (Document 27). So, while an area is pending, its pages are
   `noindex`, have no canonical, and are not in the sitemap, whatever the
   build — and a developer cannot make demo content indexable by setting
   a production domain. scripts/prerender.mjs checks the same thing from
   the other side and fails a production-domain build that would index a
   page still showing placeholder content.

   Each route names the approval areas whose content it shows. A route not
   listed here is never indexable. */
const approved = (area) => APPROVALS[area]?.status === "approved";
const allApproved = (areas) => areas.length > 0 && areas.every(approved);

const AREAS = {
  "/": ["coreIdentity", "programs", "impact", "stories"],
  "/about": ["coreIdentity", "financials"],
  "/work": ["programs"],
  ...Object.fromEntries(PROGRAMS.map((p) => [p.to, ["programs"]])),
  "/work/projects": ["programs"],
  "/impact": ["impact", "programs"],
  "/impact/where-we-work": ["geography"],
  "/impact/our-approach": ["programs"],
  "/get-involved": ["forms"],
  ...Object.fromEntries(GET_INVOLVED.paths.map((p) => [p.to, ["forms"]])),
  "/appeals": ["donation"],
  "/stories": ["stories"],
  "/contact": ["contact"],
  "/about/team": ["team"],
  "/about-us/careers": ["contact"],
  ...Object.fromEntries(POLICIES.filter((p) => p.route).map((p) => [p.route, ["policies"]])),
};
export const approvalAreas = (route) => AREAS[route] ?? [];

const verified = (block) => ["verified", "approved"].includes(block?.status);

/* ---------------- URLs ---------------- */

/* "/about/" → "/about"; query and hash dropped. Filters such as
   /stories?category=field are views of one page, not pages of their own. */
export const canonicalPath = (pathname) => {
  const path = (pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "");
  return path === "" ? "/" : path;
};

/* An absolute URL on the production origin, or null when none is
   configured. `src` may already be absolute (an approved remote image). */
export const absoluteUrl = (src) => {
  if (!src) return null;
  if (/^https:\/\//.test(src)) return src;
  if (!ENV.siteOrigin) return null;
  return `${ENV.siteOrigin}${src.startsWith("/") ? "" : "/"}${src}`;
};

/* ---------------- Page rules ----------------
   Per route: a description (from the page's own content), and whether it
   may be indexed. `index` is a function so it tracks content state — the
   Stories directory becomes indexable the day a story is approved,
   without anyone remembering to flip a flag here. Routes not listed fall
   back to the sitemap entry's own description and to NOINDEX: an
   unreviewed page is never indexed by accident. */
const programList = PROGRAMS.map((p) => p.title);
const joined = `${programList.slice(0, -1).join(", ")} and ${programList.at(-1)}`;

const RULES = {
  /* The homepage's SEO is the CMS's once a homepage is published there
     (its own title, description and share image; `noIndex` can only take
     it out of the index) — the site defaults otherwise. */
  "/": {
    title: PUBLISHED_HOMEPAGE.page?.seo?.title,
    description: PUBLISHED_HOMEPAGE.page?.seo?.description ?? SITE.description,
    image: PUBLISHED_HOMEPAGE.page?.seo?.image,
    imageAlt: PUBLISHED_HOMEPAGE.page?.seo?.imageAlt,
    index: () => !PUBLISHED_HOMEPAGE.page?.seo?.noIndex,
  },

  /* Sections whose own content is real: mission, vision, program areas,
     the ways to take part. */
  /* The one About page: who RBB is, mission and vision, values, how it
     works, and transparency and financials — the old standalone pages
     forward to its sections, so this is the only indexable copy. */
  /* The About page's SEO is the CMS's once it is published there (as the
     homepage's); its own description otherwise. */
  "/about": {
    title: PUBLISHED_ABOUT.page?.seo?.title,
    description: PUBLISHED_ABOUT.page?.seo?.description ?? `Who ${BRAND.fullName} is: its mission, vision and values, how it works, and its transparency and financials.`,
    image: PUBLISHED_ABOUT.page?.seo?.image,
    imageAlt: PUBLISHED_ABOUT.page?.seo?.imageAlt,
    index: () => !PUBLISHED_ABOUT.page?.seo?.noIndex,
  },
  "/work": {
    description: `The four program areas of ${BRAND.fullName}: ${joined}.`,
    index: () => true,
  },
  /* A program published from the CMS may set its own SEO title,
     description and share image; `noIndex` can only take it out of the
     index. Source programs carry none: their rule is unchanged. */
  ...Object.fromEntries(
    PROGRAMS.map((p) => [
      p.to,
      {
        title: p.seo?.title,
        description: p.seo?.description ?? `${p.description} One of the four program areas of ${BRAND.fullName}.`,
        image: p.seo?.image,
        imageAlt: p.seo?.imageAlt,
        index: () => !p.seo?.noIndex,
      },
    ])
  ),
  /* The Impact page's SEO is the CMS's once it is published there (as the
     About page's); otherwise its menu entry's description, as before. */
  "/impact": {
    title: PUBLISHED_IMPACT.page?.seo?.title,
    description: PUBLISHED_IMPACT.page?.seo?.description,
    image: PUBLISHED_IMPACT.page?.seo?.image,
    imageAlt: PUBLISHED_IMPACT.page?.seo?.imageAlt,
    index: () => !PUBLISHED_IMPACT.page?.seo?.noIndex,
  },
  "/get-involved": { index: () => true },
  /* The donation page's successor, indexed as it was. The appeals on it
     are not: each is a working placeholder until RBB supplies it. Its
     title and description are the CMS's once the page is published there
     (undefined otherwise: the sitemap entry's own). */
  "/appeals": {
    title: PUBLISHED_GENERAL_DONATION.page?.seo?.title,
    description: PUBLISHED_GENERAL_DONATION.page?.seo?.description,
    /* Milestone 3: its own share image, and `noIndex` only ever removing it. */
    image: PUBLISHED_GENERAL_DONATION.page?.seo?.image,
    imageAlt: PUBLISHED_GENERAL_DONATION.page?.seo?.imageAlt,
    index: () => !PUBLISHED_GENERAL_DONATION.page?.seo?.noIndex,
  },
  /* Appeals published from the CMS: their own title and description.
     Still never indexed — appeal routes have no approval area (AREAS). */
  ...Object.fromEntries(APPEALS.filter((a) => a.seo).map((a) => [appealPath(a), { title: a.seo.title, description: a.seo.description, image: a.seo.image, imageAlt: a.seo.imageAlt }])),
  ...Object.fromEntries(GET_INVOLVED.paths.map((p) => [p.to, { description: p.metaDescription, index: () => true }])),
  "/contact": { description: CONTACT_COPY.metaDescription, index: () => true },

  /* Directories — indexed once they list something. Until then their
     description says what they are for, not what they contain. */
  "/stories": {
    description: `Stories from the work of ${BRAND.fullName}.`,
    index: () => published().length > 0,
  },
  "/work/projects": {
    description: `Projects across the four program areas of ${BRAND.fullName}.`,
    index: () => PROJECTS.length > 0,
  },
  "/about/team": { index: () => approvedMembers().length > 0 },
  /* The Careers page's SEO is the CMS's once it is published there
     (M13: its own title and description, `noIndex` only ever removing it);
     as before, it is indexed only with an open role. */
  "/about-us/careers": {
    title: CAREERS.seoTitle ?? CAREERS.title,
    description: CAREERS.metaDescription,
    index: () => CAREERS.roles.some((r) => verified(r)) && !CAREERS.noIndex,
  },

  /* Pages whose substance is still pending. */
  "/impact/where-we-work": {
    description: `Where the work of ${BRAND.fullName} reaches.`,
    /* #6: indexed once a published list exists — regions or countries. */
    index: () => verified(IMPACT.geography) && (IMPACT.geography.regions.length > 0 || IMPACT.geography.countries.length > 0),
  },
  "/impact/our-approach": { index: () => verified(IMPACT.approach) },

  /* Policies — indexed only once published (content/policies.js). */
  /* A policy whose text is pending or still working says so in its
     description too, never "The … privacy policy." */
  ...Object.fromEntries(
    POLICIES.filter((p) => p.route).map((p) => [
      p.route,
      { index: () => isFinalPolicy(p), description: isFinalPolicy(p) ? undefined : SITE.previewDescription },
    ])
  ),

};

/* The sitemap's own entries, by route — title, parent, description. */
const PAGE_BY_ROUTE = new Map(PAGES.map((p) => [p.to, p]));

/* ---------------- Structured data ---------------- */

/* The organization, for schema.org/Organization. PENDING: Document 14
   waits for RBB's approved name, logo (a raster image) and public
   contact / social details before any is published. Only verified social
   accounts ever enter `sameAs`. */
export const ORGANIZATION = {
  status: "pending",
  name: BRAND.fullName,
  logo: null,
};

export const organizationSchema = () => {
  if (ORGANIZATION.status !== "approved" || !ORGANIZATION.logo || !ENV.siteOrigin) return null;
  const sameAs = verifiedOnly(ORG_CONTACT.social).map((s) => s.url);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl(ORGANIZATION.logo),
    ...(sameAs.length > 0 && { sameAs }),
  };
};

/* The visible breadcrumb (PageHeader: Home › section › page), as
   schema.org/BreadcrumbList. Needs absolute URLs, so it waits for the
   origin like everything else. */
export const breadcrumbSchema = (trail) => {
  if (!ENV.siteOrigin || trail.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.to),
    })),
  };
};

/* ---------------- Assembly ---------------- */

/* The full metadata record from its parts. Social fields mirror the
   page's own title and description; an image appears only when it is
   approved AND can be given an absolute URL — otherwise it is omitted,
   never replaced with a placeholder. */
/* Keeping a non-production deployment out of the index is infrastructure,
   not content (Document 27): the preview host sends X-Robots-Tag, and
   absolute URLs appear only once ENV.siteOrigin is a verified production
   origin. This file decides indexability from the page's own content
   alone. */
/* The share image (Milestone 3): the page's own — its SEO image, else the
   image a page already uses as its own (a story's, a project's, a
   person's) — and only when that is a usable absolute URL; otherwise the
   site-wide default from the published settings (SITE.shareImage);
   otherwise none. Never a placeholder. */
const shareImageOf = (image, imageAlt) => {
  const own = absoluteUrl(image);
  if (own) return { src: own, alt: imageAlt };
  const fallback = absoluteUrl(SITE.shareImage?.src);
  return fallback ? { src: fallback, alt: SITE.shareImage.alt } : null;
};

const build = ({ route, title, description, robots, image, imageAlt, ogType = "website", schema = [], areas = [] }) => {
  const indexable = robots === INDEX;
  const canonical = indexable ? absoluteUrl(canonicalPath(route)) : null;
  /* A page that may not be indexed gets no share image and no structured
     data either: both present it as finished, citable content. */
  const share = indexable ? shareImageOf(image, imageAlt) : null;
  const ogImage = share?.src ?? null;
  const graph = indexable ? schema.filter(Boolean) : [];
  return {
    route,
    canonicalPath: canonicalPath(route),
    canonical,
    title,
    description,
    robots,
    status: robots === INDEX ? "indexable" : "pending",
    ogTitle: title ?? SITE.name,
    ogDescription: description,
    ogType,
    ogUrl: canonical,
    ogImage,
    ogImageAlt: ogImage ? share.alt : null,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: title ?? SITE.name,
    twitterDescription: description,
    twitterImage: ogImage,
    schemaType: graph.map((s) => s["@type"]),
    schemaData: graph,
    /* The approvals this page waits on — for the prerender gate's
       message, never rendered. */
    approvalAreas: areas,
  };
};

/* A sitemap route's metadata. `overrides` lets a page that knows more
   about itself (a Placeholder's derived title) fill the gaps. */
/* `overrides` also carries a detail page's own share image and `noIndex`
   (Milestone 3: news, blog and event pages): `noIndex` can only take the
   page out of the index; the image is used only if the page is indexed. */
export function routeMeta(pathname, overrides = {}) {
  const route = canonicalPath(pathname);
  const page = PAGE_BY_ROUTE.get(route);
  const rule = RULES[route] ?? {};
  const indexable = Boolean(rule.index?.()) && allApproved(approvalAreas(route)) && !overrides.noIndex;
  const title = route === "/" ? rule.title : (overrides.title ?? rule.title ?? page?.title ?? page?.label);
  const description = rule.description ?? page?.description ?? overrides.description ?? SITE.description;

  const trail = page?.parent
    ? [{ label: "Home", to: "/" }, page.parent, { label: page.title ?? page.label, to: route }]
    : page
      ? [{ label: "Home", to: "/" }, { label: page.title ?? page.label, to: route }]
      : [];

  return build({
    route,
    title,
    description,
    robots: indexable ? INDEX : NOINDEX,
    ...((rule.image ?? overrides.image) && { image: rule.image ?? overrides.image, imageAlt: rule.image ? rule.imageAlt : overrides.imageAlt }),
    schema: indexable ? [route === "/" ? organizationSchema() : breadcrumbSchema(trail)] : [],
    areas: approvalAreas(route),
  });
}

/* A detail record (story, project, profile) may be indexed only when its
   approval area is approved AND the record carries no working
   placeholder. Otherwise it is a PREVIEW page: still rendered in full for
   review, but `noindex`, no canonical, no share image, no structured data,
   out of the sitemap — and its description is the neutral preview line,
   never its excerpt, which would read as a real RBB fact in a snippet. */
const detailIndexable = (area, record) => approved(area) && !isWorkingContent(record);

/* The 404 — and every unknown or unapproved slug. Never indexed, never a
   canonical, and never the slug in the title. */
export const notFoundMeta = () =>
  build({ route: "/404", title: SITE.notFoundTitle, description: SITE.description, robots: "noindex, nofollow" });

/* One approved story. Article schema only from fields the story itself
   carries: headline, its approved date and image. No author or publisher
   is added that the story does not state. */
/* A CMS story or project may set its own SEO title, description and share
   image (M12); `noIndex` can only take it out of the index. Source records
   carry none: their metadata is unchanged. */
export function storyMeta(story) {
  const route = storyPath(story);
  const category = categoryById(story.category);
  const image = story.seo?.image ?? story.image?.src;
  const indexable = detailIndexable("stories", story) && !story.seo?.noIndex;
  return build({
    route,
    areas: ["stories"],
    title: story.seo?.title ?? story.title,
    description: indexable
      ? (story.seo?.description ?? story.excerpt ?? `${category ? `${category.label}: ` : ""}${story.title}.`)
      : SITE.previewDescription,
    robots: indexable ? INDEX : NOINDEX,
    image,
    imageAlt: story.seo?.image ? story.seo.imageAlt : story.image?.alt,
    ogType: "article",
    schema: [
      ENV.siteOrigin && {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: story.title,
        mainEntityOfPage: absoluteUrl(route),
        ...(story.date && { datePublished: story.date }),
        ...(story.author && { author: { "@type": "Person", name: story.author } }),
        ...(absoluteUrl(image) && { image: [absoluteUrl(image)] }),
      },
      breadcrumbSchema([
        { label: "Home", to: "/" },
        { label: "Stories", to: "/stories" },
        { label: story.title, to: route },
      ]),
    ],
  });
}

/* One verified project (content/work.js lists verified projects only). */
export function projectMeta(project) {
  const route = projectPath(project);
  const program = PROGRAMS.find((p) => p.slug === project.program);
  const indexable = detailIndexable("programs", project) && !project.seo?.noIndex;
  return build({
    route,
    areas: ["programs"],
    title: project.seo?.title ?? project.title,
    description: indexable
      ? (project.seo?.description ?? project.description ?? `${project.title} — a ${program ? `${program.title} ` : ""}project of ${BRAND.fullName}.`)
      : SITE.previewDescription,
    robots: indexable ? INDEX : NOINDEX,
    image: project.seo?.image ?? project.image?.src,
    imageAlt: project.seo?.image ? project.seo.imageAlt : project.image?.alt,
    schema: [
      breadcrumbSchema([
        { label: "Home", to: "/" },
        { label: "Our Work", to: "/work" },
        { label: "All Projects", to: "/work/projects" },
        { label: project.title, to: route },
      ]),
    ],
  });
}

/* One approved team member with an approved profile. Person schema only
   from their approved name, role and photograph — no contact details. */
export function memberMeta(member) {
  const route = memberPath(member);
  const indexable = detailIndexable("team", member);
  return build({
    route,
    areas: ["team"],
    title: member.name,
    description: indexable
      ? (member.shortBio ?? `${member.name}${member.role ? `, ${member.role}` : ""} — ${BRAND.fullName}.`)
      : SITE.previewDescription,
    robots: indexable ? INDEX : NOINDEX,
    image: member.image,
    imageAlt: member.imageAlt,
    ogType: "profile",
    schema: [
      ENV.siteOrigin && {
        "@context": "https://schema.org",
        "@type": "Person",
        name: member.name,
        url: absoluteUrl(route),
        ...(member.role && { jobTitle: member.role }),
        ...(absoluteUrl(member.image) && { image: absoluteUrl(member.image) }),
        worksFor: { "@type": "Organization", name: BRAND.fullName },
      },
      breadcrumbSchema([
        { label: "Home", to: "/" },
        { label: "Our Team", to: "/about/team" },
        { label: member.name, to: route },
      ]),
    ],
  });
}

/* "Education" → "Education | Rising Beyond Borders"; the homepage is the
   name alone. One organization name, no appended keywords. */
export const documentTitle = (title) => (title ? `${title} | ${SITE.name}` : SITE.name);

/* Every <head> tag one record produces, in order — the ONE list both
   hooks/useSeo.js (in the browser) and the pre-renderer (at build) write
   from, so a page's initial HTML and its hydrated head never disagree.
   A null value means "no such tag". */
export const seoTags = (meta) => [
  { attr: "name", key: "description", value: meta.description },
  { attr: "name", key: "robots", value: meta.robots },
  { link: "canonical", value: meta.canonical },
  { attr: "property", key: "og:site_name", value: SITE.name },
  { attr: "property", key: "og:type", value: meta.ogType },
  { attr: "property", key: "og:title", value: meta.ogTitle },
  { attr: "property", key: "og:description", value: meta.ogDescription },
  { attr: "property", key: "og:url", value: meta.ogUrl },
  { attr: "property", key: "og:image", value: meta.ogImage },
  { attr: "property", key: "og:image:alt", value: meta.ogImageAlt },
  { attr: "name", key: "twitter:card", value: meta.twitterCard },
  { attr: "name", key: "twitter:title", value: meta.twitterTitle },
  { attr: "name", key: "twitter:description", value: meta.twitterDescription },
  { attr: "name", key: "twitter:image", value: meta.twitterImage },
  { attr: "name", key: "twitter:image:alt", value: meta.ogImageAlt },
  { jsonLd: true, value: meta.schemaData?.length ? (meta.schemaData.length === 1 ? meta.schemaData[0] : meta.schemaData) : null },
];

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* The same tags as an HTML string, for the pre-rendered page. JSON-LD is
   escaped so no value can close its <script>. */
export const seoHeadHtml = (meta) =>
  [
    `<title>${escapeHtml(documentTitle(meta.title))}</title>`,
    ...seoTags(meta)
      .filter((t) => t.value != null && t.value !== "")
      .map((t) =>
        t.link
          ? `<link rel="${t.link}" href="${escapeHtml(t.value)}" data-seo />`
          : t.jsonLd
            ? `<script type="application/ld+json" data-seo>${JSON.stringify(t.value).replace(/</g, "\\u003c")}</script>`
            : `<meta ${t.attr}="${t.key}" content="${escapeHtml(t.value)}" data-seo />`
      ),
  ].join("\n    ");

/* ---------------- Sitemap & robots ---------------- */

/* Every indexable canonical route: the sitemap pages that pass their
   rule, then approved stories, verified projects and approved profiles.
   Redirects (`section` forwards and App.jsx aliases), 404s, pending pages
   and dev routes are never in it, because none of them is indexable. */
export function sitemapRoutes() {
  const pages = ["/", ...PAGES.filter((p) => !p.section).map((p) => p.to), "/about-us/careers"];
  const indexable = pages.filter((to) => routeMeta(to).robots === INDEX);
  /* Detail pages only when their own metadata says indexable — a
     preview (working) record is never in the sitemap. */
  return [
    ...new Set([
      ...indexable,
      ...published().filter((s) => storyMeta(s).robots === INDEX).map(storyPath),
      ...PROJECTS.filter((p) => projectMeta(p).robots === INDEX).map(projectPath),
      ...approvedMembers().filter(hasProfile).filter((m) => memberMeta(m).robots === INDEX).map(memberPath),
    ]),
  ];
}

const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* sitemap.xml — or null with no verified origin: a sitemap of guessed
   URLs is worse than none. No <lastmod>: the site has no approved
   modification dates, and a build date is not one. */
export function sitemapXml() {
  if (!ENV.siteOrigin) return null;
  const urls = sitemapRoutes()
    .map((to) => `  <url><loc>${xmlEscape(absoluteUrl(to))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/* robots.txt — allows everything. Nothing unpublished is routable in the
   first place, and per-page `noindex` does the rest; robots.txt is not a
   privacy control. The Sitemap line appears once the origin is known. */
export function robotsTxt() {
  const lines = ["User-agent: *", "Allow: /"];
  if (ENV.siteOrigin) lines.push("", `Sitemap: ${ENV.siteOrigin}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/* ---------------- Analytics & search verification ----------------
   None. No analytics, tag manager or Search Console verification is
   approved (Document 14 §15), so nothing is loaded and no hook is wired.
   Adding one needs RBB's approval AND an update to the privacy policy
   and TECHNOLOGY_AUDIT in content/policies.js. */
