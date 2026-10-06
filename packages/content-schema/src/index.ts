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
export { HeadingNode, Inline, LinkNode, ListNode, Mark, ParagraphNode, RichText, TextNode } from "./richText/richText.ts";
export { MIME_TYPES, Media, MediaKind } from "./media/media.ts";
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
  DonationDesignation,
  DonationFormConfig,
  DonationFormOverrides,
  DonationSettings,
  resolveDonationForm,
} from "./donation/donation.ts";
export { AppealKind } from "./appeals/kind.ts";
export { Appeal, AppealDonation, AppealHighlight, DonationHero, GeneralDonationPage } from "./appeals/appeal.ts";
export { Metric, MetricVerification } from "./impact/metric.ts";
export { Post, PostType } from "./posts/post.ts";
export { Event, ScheduleItem } from "./events/event.ts";
export { Announcement, Popup } from "./engagement/engagement.ts";
export { HeroSlide, Homepage, HomepageHero, HomepageVideo, SlotHeading, TimelineItem } from "./homepage/homepage.ts";
export { ContactMethod, Office, SiteSettings, SocialPlatform } from "./settings/siteSettings.ts";
