import { StrictMode } from "react";
import { PublishedSnapshot } from "@rbb/content-schema";
import PUBLISHED_SNAPSHOT from "virtual:rbb-published-snapshot";
import { snapshotState } from "./lib/runtimeBoot.js";
import { ORG_ID } from "./contract/org.js";
import { imageOrigins as snapshotImageOrigins } from "../scripts/snapshot-adapter.mjs";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { Shell } from "./App.jsx";
import { SeoCollector } from "./hooks/useSeo.js";
import { CAREERS_PATH, STUB_PATHS, redirectMap } from "./config/routes.js";
import { PAGES, POLICIES } from "./content/index.js";
import { published, storyPath } from "./content/stories.js";
import { mediaDetailPaths } from "./content/media.js";
import { PROJECTS, projectPath } from "./content/work.js";
import { approvedMembers, hasProfile, memberPath } from "./content/team.js";
import {
  absoluteUrl,
  notFoundMeta,
  robotsTxt,
  seoHeadHtml,
  sitemapXml,
} from "./content/seo.js";
import { observabilityReport } from "./config/observability.js";
import { EVENTS } from "./lib/analytics.js";
import { validateContent } from "./content/validate.js";
import { DONATION, donationPreview, donationState } from "./content/donation.js";
import { PUBLISHED_HOMEPAGE } from "./content/homepage.js";
import { ENV } from "./config/env.js";
import { IMPACT } from "./content/impact.js";
import { TRANSPARENCY, publishedDocuments } from "./content/transparency.js";
import { ORG_CONTACT, verifiedOnly } from "./content/contact.js";
import { SOCIALS } from "./content/footer.js";
import { isFinalPolicy, isPublished } from "./content/policies.js";
import { FORMS } from "./content/forms.js";
import { formState } from "./lib/forms.js";
import { PROGRAMS } from "./content/work.js";

/* The build-time renderer — Document 15. scripts/prerender.mjs loads the
   SSR build of this file and calls `render` once per public route, so
   every page ships as real HTML: its content, title, description,
   canonical and social tags present before any JavaScript runs. The
   browser then hydrates the same tree (main.jsx).

   Nothing here runs in a visitor's browser, and there is no server: the
   output is static files. */

/* One route → { html, head }. `head` is the page's own <head> tags,
   collected from useSeo during the render. */
export function render(url) {
  const collector = {};
  const html = renderToString(
    <StrictMode>
      <SeoCollector.Provider value={collector}>
        <StaticRouter location={url}>
          <Shell />
        </StaticRouter>
      </SeoCollector.Provider>
    </StrictMode>
  );
  if (!collector.meta) throw new Error(`No metadata was set while rendering ${url}`);
  return { html, meta: collector.meta, head: seoHeadHtml(collector.meta) };
}

/* Every route that is a page, to be written as its own HTML file:
   - the sitemap's pages (not its `section` forwards — those redirect)
   - Careers and the older stub addresses, which stay reachable but carry
     `noindex` (content/seo.js). The legacy giving pages were retired
     (D35): three forward to Donate (config/routes.js REDIRECTS)
   - each APPROVED story, verified project and approved profile.
   Drafts, pending records and unknown slugs are not in this list: they
   get no file, so the host serves 404.html for them. */
export function prerenderPaths() {
  return [
    ...new Set([
      "/",
      ...PAGES.filter((p) => !p.section).map((p) => p.to),
      CAREERS_PATH,
      ...STUB_PATHS,
      ...POLICIES.filter((p) => p.route).map((p) => p.route),
      ...published().map(storyPath),
      ...PROJECTS.map(projectPath),
      ...approvedMembers().filter(hasProfile).map(memberPath),
      ...mediaDetailPaths(),
    ]),
  ];
}

/* Every permanent redirect, including /blogs/<slug> for each approved
   story (the old address pattern for posts). */
export function redirects() {
  return [
    ...redirectMap(),
    ...published().map((story) => ({
      from: `/blogs/${story.slug}`,
      to: storyPath(story),
    })),
  ];
}

/* Content validation (Document 18), against the routes this build will
   actually publish. `preview` checks records still being prepared as if
   they were approved (npm run validate:content). */
/* Every form's configured endpoint (Document 21), for the build's CSP
   check: same-origin paths need nothing, anything else must be approved. */
export { FORMS } from "./content/forms.js";

export const validate = (preview = false) =>
  validateContent({ pages: prerenderPaths(), redirects: redirects(), preview });

/* Every image an approved record will publish, so the pre-renderer can
   confirm each one exists in the build output. */
export const publicImages = () =>
  [
    /* Media-library images (`mediaId`: CMS stories and projects) are
       served from the library's public origin, not from the build. */
    ...published().flatMap((s) => [s.image, ...(s.media ?? [])]).filter((i) => i && !i.mediaId).map((i) => i.src),
    ...PROJECTS.map((p) => p.image).filter((i) => i && !i.mediaId).map((i) => i.src),
    /* A photograph from the CMS's media library (`imageId`) is served from
       the library's public origin, not from the build. */
    ...approvedMembers().filter((m) => !m.imageId).map((m) => m.image),
    ...DONATION.givingMethods
      .filter((m) => m.status === "approved")
      .map((m) => m.image?.src),
  ].filter(Boolean);

/* The verified production origin, or null — first-party for the
   pre-renderer's third-party origin check. */
export const siteOrigin = () => ENV.siteOrigin;

/* Whether the published homepage plays YouTube — its film or a timeline
   Short — so its page policy allows the player's frame
   (scripts/security-policy.mjs VIDEO). */
export const featuredVideo = () =>
  (PUBLISHED_HOMEPAGE.page?.sections ?? []).some((s) => (s.type === "video" && s.data.youtubeId) || (s.type === "timeline" && s.data.events?.some((e) => e.youtubeId)));

/* Release readiness facts (Document 24) — what this build's CONTENT
   says about each approval area, for scripts/release-status.mjs. Counts
   and statuses only, never content. */
export const readiness = () => ({
  siteOrigin: Boolean(ENV.siteOrigin),
  impactFigures: IMPACT.metrics.map((m) => ({ id: m.id, status: m.status })),
  financialOverview: TRANSPARENCY.financialOverview.status,
  documents: {
    annualReports: publishedDocuments(TRANSPARENCY.annualReports).length,
    financial: publishedDocuments(TRANSPARENCY.financialDocuments).length,
    governance: TRANSPARENCY.governance.status,
  },
  programsWithDetail: PROGRAMS.filter((p) => p.why && p.activities?.length).length,
  projects: PROJECTS.length,
  stories: published().length,
  team: approvedMembers().length,
  geography: IMPACT.geography.status,
  contactMethods: verifiedOnly(ORG_CONTACT.methods).length,
  policiesPublished: POLICIES.filter(isPublished).map((p) => p.id),
  /* Published AND not working text — what a launch needs (release:check). */
  policiesFinal: POLICIES.filter(isFinalPolicy).map((p) => p.id),
  /* Social links shown, and whether each is only the platform's home page
     (a placeholder, not an RBB account). URLs only — no secrets here. */
  socials: SOCIALS.map((s) => ({ platform: s.icon, homepageOnly: /^https:\/\/(www\.)?[^/]+\/?$/.test(s.href ?? "") })),
  forms: Object.fromEntries(Object.entries(FORMS).map(([id, f]) => [id, formState(f)])),
  /* `preview`: the donation page draws the checkout's no-payment preview
     (content/donation.js) — release:check refuses production while it is. */
  donation: { state: donationState(), preview: donationPreview() },
});

/* What this build would measure (Document 17): each stream's approval
   and whether it is enabled here, and each analytics event's status. */
export const observability = () => ({
  streams: observabilityReport(),
  events: Object.fromEntries(Object.entries(EVENTS).map(([name, e]) => [name, e.status])),
});

export { absoluteUrl, notFoundMeta, robotsTxt, seoHeadHtml, sitemapXml };

/* The published snapshot this build applied (or null), checked against the
   content contract. The pre-renderer stops the build on any problem — a
   snapshot is used whole and valid, or not at all. Server build only. */
export const publishedSnapshotInfo = () => {
  if (!PUBLISHED_SNAPSHOT) return { snapshot: null, problems: [], imageOrigins: [] };
  const result = PublishedSnapshot.safeParse(PUBLISHED_SNAPSHOT);
  const problems = result.success ? [] : result.error.issues.map((i) => `${i.path.join(".") || "(snapshot)"}: ${i.message}`);
  if (PUBLISHED_SNAPSHOT.organization?.id !== ORG_ID) problems.push(`organization.id: must be this site's organization ("${ORG_ID}")`);
  /* A runtime-snapshot build applies the baked values through the same
     hook a visitor's browser uses (src/lib/runtimeOverrides.js): every
     target it sets must have taken them while the modules loaded here. */
  if (ENV.runtimeSnapshot) {
    const state = snapshotState();
    if (state.failed) problems.push(`runtime hook: ${state.failed.message}`);
    for (const file of Object.keys(state.overrides ?? {})) if (!state.applied.includes(file)) problems.push(`runtime hook: ${file} never applied the snapshot — is it still a target module (scripts/vite-published-snapshot.mjs)?`);
  }
  return {
    snapshot: { version: PUBLISHED_SNAPSHOT.version, generatedAt: PUBLISHED_SNAPSHOT.generatedAt, collections: Object.keys(PUBLISHED_SNAPSHOT.content ?? {}) },
    problems,
    imageOrigins: snapshotImageOrigins(PUBLISHED_SNAPSHOT),
  };
};
