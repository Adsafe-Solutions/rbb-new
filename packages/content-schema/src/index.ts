/* @rbb/content-schema — the content contract between the CMS/API and the
   public web. Zod schemas are the single source of truth; each exported
   schema has a TypeScript type of the same name, inferred from it.
   Plain JSON data only: no React, no browser APIs, no functions in
   records. See README.md. */

export {
  EntityId,
  IsoDate,
  IsoDateTime,
  MediaId,
  OrgId,
  Paragraphs,
  ReleaseMarker,
  Slug,
  TimeOfDay,
  YouTubeId,
  text,
} from "./common/primitives.ts";
export { Href, HttpsUrl, InternalPath, Link, isSafeHref } from "./common/link.ts";
export { PublicationStatus, recordFields } from "./common/record.ts";
export { IANA_ZONE_NAME, IanaTimeZone, LocalDateTime, PublicationSchedule, ScheduleRequest, UtcInstant, instantToZonedTime, isIanaTimeZone, zonedTimeToInstant, type ZonedConversion } from "./common/schedule.ts";
export { HeadingNode, Inline, LinkNode, ListNode, Mark, ParagraphNode, RichText, TextNode } from "./richText/richText.ts";
export { FOCAL_POINT_PATTERN, FocalPoint, MIME_TYPES, Media, MediaKind, isFocalPoint } from "./media/media.ts";
export { SeoDefaults, SeoOverrides } from "./seo/seo.ts";
export {
  AppealListData,
  AppealListSection,
  CtaData,
  CtaSection,
  FaqData,
  FaqItem,
  FaqSection,
  ImageTextData,
  ImageTextSection,
  NumberedCardsData,
  NumberedCardsSection,
  RichTextData,
  RichTextSection,
  SECTION_TYPES,
  Section,
  StatementData,
  StatementSection,
  StatsData,
  StatsSection,
  TrustData,
  TrustSection,
} from "./sections/blocks.ts";
export type { SectionType } from "./sections/blocks.ts";
export { MAX_SECTIONS, SECTION_ALLOWLIST, sectionsFor } from "./sections/allowlists.ts";
export type { SectionPageType } from "./sections/allowlists.ts";
export {
  DonationCheckout,
  DonationDesignation,
  DonationFormConfig,
  DonationFormOverrides,
  DonationSettings,
  GIVEBUTTER_FREQUENCIES,
  resolveDonationForm,
} from "./donation/donation.ts";
export { AppealKind } from "./appeals/kind.ts";
export { Appeal, AppealDonation, AppealHighlight, DonationHero, GeneralDonationPage } from "./appeals/appeal.ts";
export { Metric, MetricVerification } from "./impact/metric.ts";
export { BLOG_CATEGORY_IDS, Post, PostType, STORY_CATEGORY_IDS, STORY_IMPACT_MAX, STORY_QUOTES_MAX, StoryImpact, StoryQuote, StoryQuotes } from "./posts/post.ts";
export { Event, EventRegistration, ScheduleItem, minutesOf } from "./events/event.ts";
export { Announcement, AnnouncementBar, AnnouncementBarItem, POPUP_RECORD_ID, Popup, STORY_STRIP_LIMIT, StoryStrip, announcementBarApprovalProblems, popupCmsProblems, storyStripApprovalProblems } from "./engagement/engagement.ts";
export {
  EventListData,
  HOMEPAGE_SECTION_SCHEMAS,
  HeroSlide,
  Homepage,
  HomepageAppealListData,
  HomepageHero,
  HomepageSection,
  HomepageSections,
  HomepageVideo,
  PostListData,
  SlotHeading,
  TimelineItem,
  homepageMediaIds,
  homepageReferences,
} from "./homepage/homepage.ts";
export { HOMEPAGE_BLOCKS, HOMEPAGE_BLOCK_TYPES } from "./homepage/registry.ts";
export { ABOUT_SECTION_SCHEMAS, About, AboutSection, AboutSections, MissionVisionData, PageHeroData, TransparencyPlacement, aboutMediaIds } from "./about/about.ts";
export { ABOUT_BLOCKS, ABOUT_BLOCK_TYPES } from "./about/registry.ts";
export type { AboutBlockInfo, AboutBlockType } from "./about/registry.ts";
export { TeamGroup, TeamMember } from "./team/member.ts";
export { PROGRAM_ICONS, Program } from "./programs/program.ts";
export { PROJECT_IMPACT_MAX, PROJECT_PARTNERS_MAX, Project, ProjectImpact, projectMediaIds } from "./projects/project.ts";
export { CareerRole, Careers, CareersSeo } from "./careers/careers.ts";
export { HowWeWork } from "./howWeWork/howWeWork.ts";
export { FormDefinition, FormField, FormFieldId, FormId, fieldListProblems } from "./forms/formDefinition.ts";
export { BUILT_IN_FORM_IDS, DEFAULT_FORMS, DEFAULT_MAX_LENGTH, FILE_TYPES, FORM_FIELD_TYPES, MARKETING_FIELD_ID, MARKETING_LABEL, MAX_FILE_BYTES, MAX_FILE_FIELDS, NO_PLACEHOLDER_TYPES, OPTION_FIELD_TYPES, SYSTEM_FIELD_IDS, hasOptions, newCareerForm, newEventRegistration } from "./forms/defaults.ts";
export type { BuiltInFormId, EventRegistrationData, FormDefinitionData, FormFieldDefinition, FormFieldType, FormKind } from "./forms/defaults.ts";
export { POLICY_IDS, POLICY_ROUTES, Policy, PolicyId, PolicySection, PolicySeo, policyApprovalProblems } from "./policies/policy.ts";
export {
  CTA_TARGETS,
  CtaTarget,
  GET_INVOLVED_PAGE_IDS,
  GET_INVOLVED_PATH_IDS,
  GET_INVOLVED_ROUTES,
  GetInvolvedFaq,
  GetInvolvedHub,
  GetInvolvedPage,
  GetInvolvedPath,
  GetInvolvedPathId,
  GetInvolvedSection,
  RESERVED_SECTION_IDS,
  StructuredCta,
  getInvolvedApprovalProblems,
} from "./getInvolved/getInvolved.ts";
export type { GetInvolvedPageId } from "./getInvolved/getInvolved.ts";
export { WORKING_TEXT_RULES, workingTextFindings } from "./common/workingText.ts";
export { COUNTRIES, COUNTRY_NAMES, isCountryName } from "./common/countries.ts";
export type { Country } from "./common/countries.ts";
export { ApproachData, GeographyData, IMPACT_SECTION_SCHEMAS, Impact, ImpactIntroData, ImpactSection, ImpactSections, ImpactStoriesData, MeasurementData, ProgramImpactData, TeasersData, impactMediaIds, impactReferences } from "./impact/impact.ts";
export { IMPACT_BLOCKS, IMPACT_BLOCK_TYPES, IMPACT_CHAPTER_TYPES } from "./impact/registry.ts";
export type { ImpactBlockInfo, ImpactBlockType } from "./impact/registry.ts";
export { FinancialOverview, FinancialShare, Governance, Transparency } from "./transparency/transparency.ts";
export { REPORT_CATEGORIES, Report, ReportCategory } from "./transparency/report.ts";
export type { HomepageBlockInfo, HomepageBlockType } from "./homepage/registry.ts";
export { ContactMethod, Office, SiteSettings, SocialPlatform } from "./settings/siteSettings.ts";
export {
  PublishedMedia,
  PublishedSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  SnapshotContent,
  appealMediaIds,
  donationPageMediaIds,
  recordMediaIds,
  sectionMediaIds,
  settingsMediaIds,
  snapshotMediaIds,
} from "./snapshot/snapshot.ts";
