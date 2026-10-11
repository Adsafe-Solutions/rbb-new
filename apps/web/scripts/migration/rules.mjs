/* What the CMS accepts, read from the API and the content contract
   themselves — never restated here, so the rehearsal can never drift from
   them: each collection's editable fields, required fields and contract
   (apps/api/src/modules/<x>/service.ts), the page contracts
   (packages/content-schema) and the donation page's drawn section types.
   Importing these modules connects to nothing. */
import { STORY_COLLECTION } from "../../../api/src/modules/stories/service.ts";
import { POST_COLLECTION } from "../../../api/src/modules/posts/service.ts";
import { PROJECT_COLLECTION } from "../../../api/src/modules/projects/service.ts";
import { PROGRAM_COLLECTION } from "../../../api/src/modules/programs/service.ts";
import { TEAM_COLLECTION } from "../../../api/src/modules/team/service.ts";
import { EVENT_COLLECTION } from "../../../api/src/modules/events/service.ts";
import { METRIC_COLLECTION } from "../../../api/src/modules/metrics/service.ts";
import { REPORT_COLLECTION } from "../../../api/src/modules/reports/service.ts";
import { DRAWN_SECTIONS, appealCollection } from "../../../api/src/modules/appeals/service.ts";
import { About, AnnouncementBar, Careers, GeneralDonationPage, GetInvolvedHub, GetInvolvedPath, Homepage, Impact, Popup, SiteSettings, Transparency } from "@rbb/content-schema";

const collection = (config, extra = {}) => ({
  editable: Object.keys(config.fields),
  required: config.required,
  /* Values the API sets itself on create (a story's type; an event's
     program and schedule): a source value that differs is lost. */
  defaults: config.defaults?.() ?? {},
  contract: config.contract,
  ...extra,
});

export function cmsRules() {
  /* The appeal collection's fields do not depend on the checkout verifier. */
  const appeals = appealCollection(async () => []);
  return {
    collections: {
      program: collection(PROGRAM_COLLECTION, { store: "programs", ordered: true }),
      metric: collection(METRIC_COLLECTION, { store: "metrics", ordered: true }),
      project: collection(PROJECT_COLLECTION, { store: "projects", ordered: true }),
      team_member: collection(TEAM_COLLECTION, { store: "team_members", ordered: true }),
      story: collection(STORY_COLLECTION, { store: "posts", postType: "story" }),
      /* News and blog posts: one API, `type` says which. */
      news: collection(POST_COLLECTION, { store: "posts", postType: "news" }),
      blog: collection(POST_COLLECTION, { store: "posts", postType: "blog" }),
      event: collection(EVENT_COLLECTION, { store: "events" }),
      report: collection(REPORT_COLLECTION, { store: "reports", ordered: true }),
      appeal: collection(appeals, { store: "appeals" }),
    },
    pages: {
      settings: { contract: SiteSettings, store: "site_settings" },
      homepage: { contract: Homepage, store: "homepages" },
      about: { contract: About, store: "about_pages" },
      impact: { contract: Impact, store: "impact_pages" },
      transparency: { contract: Transparency, store: "transparency_pages" },
      careers: { contract: Careers, store: "careers_pages" },
      general_donation: { contract: GeneralDonationPage, store: "general_donation_pages", drawnSections: [...DRAWN_SECTIONS] },
      announcement_bar: { contract: AnnouncementBar, store: "announcement_bars" },
      popup: { contract: Popup, store: "popups" },
    },
    /* Milestone 9: the five Get Involved pages, one store, by page id. */
    getInvolved: { hub: GetInvolvedHub, path: GetInvolvedPath, store: "get_involved_pages" },
  };
}
