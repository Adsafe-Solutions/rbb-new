/* One import site for content, so a component never reaches past this file
   into an individual content module. When a CMS arrives, it folds in here
   and nothing that consumes content has to change. */
export { BRAND } from "./brand.js";
export { NAV, NAV_CTA, LEGAL_PAGES, PAGES } from "./nav.js";
export { SITE } from "./site.js";
export { FOOTER_COLUMNS, FOOTER_LEGAL, FOOTER_CONTACT, SOCIALS } from "./footer.js";
export {
  TEAM_MEMBERS,
  TEAM_GROUPS,
  TEAM_GOVERNANCE,
  TEAM_COPY,
  approvedMembers,
  membersIn,
  memberBySlug,
  memberCard,
  memberPath,
  hasProfile,
  featuredMembers,
} from "./team.js";
export { TRANSPARENCY, TRANSPARENCY_COPY, publishedDocuments } from "./transparency.js";
export {
  ORG_CONTACT,
  CAREERS,
  CONTACT_COPY,
  verifiedOnly,
  officeLines,
  methodHref,
  alternativeContact,
} from "./contact.js";
export {
  DONATION,
  approvedGivingMethods,
  approvedDonationFaqs,
  donationState,
  donationActionBlock,
  donationPreview,
  checkoutReady,
  legacyGivingBlock,
} from "./donation.js";
export { FORMS, FORM_COPY } from "./forms.js";
export {
  POLICIES,
  POLICY_COPY,
  policyById,
  policyByRoute,
  isPublished,
  isFinalPolicy,
  policyLink,
  policyContact,
  publishedPolicyLinks,
} from "./policies.js";
export { GIVING } from "./giving.js";
export { HOMEPAGE } from "./homepage.js";
export { IMPACT, IMPACT_PAGES, metricsNote, approachSteps, impactStats } from "./impact.js";
export { GET_INVOLVED, GET_INVOLVED_PAGES, pathCards, pathByPath } from "./getInvolved.js";
export {
  STORIES,
  STORY_CATEGORIES,
  STORIES_PAGES,
  published,
  storyBySlug,
  featuredStory,
  storiesIn,
  categoryById,
  storyPath,
  latestStories,
  storyCard,
} from "./stories.js";
export {
  WORK,
  PROGRAMS,
  PROJECTS,
  programBySlug,
  programByPath,
  projectBySlug,
  projectsIn,
  projectHighlights,
  projectPath,
} from "./work.js";
export { ZAKAT } from "./zakat.js";
export { GIFTS } from "./gifts.js";
export { ABOUT } from "./about.js";
