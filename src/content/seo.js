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
import { IMPACT } from "./impact.js";
import { PROGRAMS, PROJECTS, projectPath } from "./work.js";
import { published, storyPath, categoryById } from "./stories.js";
import { approvedMembers, hasProfile, memberPath } from "./team.js";
import { POLICIES, isPublished } from "./policies.js";

const INDEX = "index, follow";
const NOINDEX = "noindex, follow";

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
  "/": { description: SITE.description, index: () => true },

  /* Sections whose own content is real: mission, vision, program areas,
     the ways to take part. */
  "/about": {
    description: `Who ${BRAND.fullName} is: its mission, its vision and how it works.`,
    index: () => true,
  },
  "/work": {
    description: `The four program areas of ${BRAND.fullName}: ${joined}.`,
    index: () => true,
  },
  ...Object.fromEntries(
    PROGRAMS.map((p) => [
      p.to,
      {
        description: `${p.description} One of the four program areas of ${BRAND.fullName}.`,
        index: () => true,
      },
    ])
  ),
  "/impact": { index: () => true },
  "/get-involved": { index: () => true },
  ...Object.fromEntries(GET_INVOLVED.paths.map((p) => [p.to, { description: p.metaDescription, index: () => true }])),
  "/contact": { description: CONTACT_COPY.metaDescription, index: () => true },
  "/about/transparency": {
    description: `How ${BRAND.fullName} approaches transparency, financial information and governance.`,
    index: () => true,
  },

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
  "/about-us/careers": {
    title: CAREERS.title,
    description: CAREERS.metaDescription,
    index: () => CAREERS.roles.some((r) => verified(r)),
  },

  /* Pages whose substance is still pending. */
  "/impact/where-we-work": {
    description: `Where the work of ${BRAND.fullName} reaches.`,
    index: () => verified(IMPACT.geography) && IMPACT.geography.countries.length > 0,
  },
  "/impact/our-approach": { index: () => verified(IMPACT.approach) },

  /* Policies — indexed only once published (content/policies.js). */
  ...Object.fromEntries(POLICIES.filter((p) => p.route).map((p) => [p.route, { index: () => isPublished(p) }])),

  /* Legacy giving addresses (Document 11): kept so old links land, but
     they point to /get-involved/donate and must not compete with it. */
  ...Object.fromEntries(
    ["/giving", "/giving/zakat", "/gifts", "/giving/major-giving"].map((to) => [
      to,
      { title: SITE.titles[to], description: `${SITE.titles[to]} — ${BRAND.fullName}.`, index: () => false },
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
const build = ({ route, title, description, robots, image, imageAlt, ogType = "website", schema = [] }) => {
  const canonical = robots === INDEX ? absoluteUrl(canonicalPath(route)) : null;
  const ogImage = absoluteUrl(image);
  const graph = schema.filter(Boolean);
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
    ogImageAlt: ogImage ? imageAlt : null,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: title ?? SITE.name,
    twitterDescription: description,
    twitterImage: ogImage,
    schemaType: graph.map((s) => s["@type"]),
    schemaData: graph,
  };
};

/* A sitemap route's metadata. `overrides` lets a page that knows more
   about itself (a Placeholder's derived title) fill the gaps. */
export function routeMeta(pathname, overrides = {}) {
  const route = canonicalPath(pathname);
  const page = PAGE_BY_ROUTE.get(route);
  const rule = RULES[route] ?? {};
  const indexable = Boolean(rule.index?.());
  const title = route === "/" ? undefined : (overrides.title ?? rule.title ?? page?.title ?? page?.label);
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
    schema: indexable ? [route === "/" ? organizationSchema() : breadcrumbSchema(trail)] : [],
  });
}

/* The 404 — and every unknown or unapproved slug. Never indexed, never a
   canonical, and never the slug in the title. */
export const notFoundMeta = () =>
  build({ route: "/404", title: SITE.notFoundTitle, description: SITE.description, robots: "noindex, nofollow" });

/* One approved story. Article schema only from fields the story itself
   carries: headline, its approved date and image. No author or publisher
   is added that the story does not state. */
export function storyMeta(story) {
  const route = storyPath(story);
  const category = categoryById(story.category);
  const image = story.image?.src;
  return build({
    route,
    title: story.title,
    description: story.excerpt ?? `${category ? `${category.label}: ` : ""}${story.title}.`,
    robots: INDEX,
    image,
    imageAlt: story.image?.alt,
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
  return build({
    route,
    title: project.title,
    description:
      project.description ?? `${project.title} — a ${program ? `${program.title} ` : ""}project of ${BRAND.fullName}.`,
    robots: INDEX,
    image: project.image?.src,
    imageAlt: project.image?.alt,
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
  return build({
    route,
    title: member.name,
    description: member.shortBio ?? `${member.name}${member.role ? `, ${member.role}` : ""} — ${BRAND.fullName}.`,
    robots: INDEX,
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
  return [
    ...new Set([
      ...indexable,
      ...published().map(storyPath),
      ...PROJECTS.map(projectPath),
      ...approvedMembers().filter(hasProfile).map(memberPath),
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
