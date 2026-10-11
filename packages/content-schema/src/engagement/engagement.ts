import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDateTime, MediaId, Slug, text } from "../common/primitives.ts";
import { InternalPath, Link } from "../common/link.ts";
import { workingTextFindings } from "../common/workingText.ts";

/* Site-wide notices: the announcement bar over the header and the
   on-screen popup (content/announcements.js today). Whether each is
   switched on at all is a site setting (SiteSettings.engagement); these
   are the items. A published item shows; a draft or archived one does
   not.

   FUTURE fields — none of today's items is scheduled:
     startsAt / endsAt   the window an item shows in
     includePaths        (popup) the only pages it may open on */
const inWindow = (r: { startsAt?: string | undefined; endsAt?: string | undefined }) =>
  !r.startsAt || !r.endsAt || Date.parse(r.startsAt) <= Date.parse(r.endsAt);
const windowIssue = { path: ["endsAt"], message: "endsAt must not be before startsAt" };

/* One message in the announcement bar's rotation. Short: one line on a
   phone. `order` is its place in the rotation. */
export const Announcement = z
  .strictObject({
    ...recordFields,
    text: text(140),
    link: Link.optional(),
    order: z.int().min(0),
    startsAt: IsoDateTime.optional(),
    endsAt: IsoDateTime.optional(),
  })
  .refine(inWindow, windowIssue);
export type Announcement = z.infer<typeof Announcement>;

/* The popup. `key` is what a visitor's "closed" is remembered against —
   publish a new key and the popup shows again to everyone who closed the
   last one. */
export const Popup = z
  .strictObject({
    ...recordFields,
    key: Slug,
    kicker: text(60).optional(),
    heading: text(160),
    highlight: text(60).optional(),
    body: text(600),
    imageId: MediaId,
    cta: Link,
    dismissLabel: text(40),
    delayMs: z.int().min(0).max(60000),
    /* "session": once per visit. "once": once per visitor. */
    frequency: z.enum(["session", "once"]),
    /* Never opens on these pages or anything beneath them. */
    excludePaths: z.array(InternalPath).max(50),
    includePaths: z.array(InternalPath).max(50).optional(),
    startsAt: IsoDateTime.optional(),
    endsAt: IsoDateTime.optional(),
  })
  .refine((p) => !p.highlight || p.heading.includes(p.highlight), {
    path: ["highlight"],
    message: "highlight must be part of the heading",
  })
  .refine(inWindow, windowIssue);
export type Popup = z.infer<typeof Popup>;

/* The ANNOUNCEMENT BAR as the CMS manages it (M21) — ONE record per
   organization holding the bar's messages in their rotation order, so the
   bar is written, approved, scheduled and published as a whole (as the
   Careers page's roles are). Each message is what the bar draws: a short
   line and, optionally, a link to a page of this site.

     items   1–10 messages in order: a stable `id` (generated, never
             shown), `text` (one line on a phone) and an optional `link`
             ({ label, href }) whose `href` is a path on this site — the
             bar links with the site's router, never to another site.
             The website's build fails if the path is not one of its
             pages

   No time window: a message shows while the published bar holds it.
   Schedule the bar's publication to start a message; archive it or
   publish a new revision to end one. Whether the bar shows at all, and how
   long each message stays, are the organization's settings
   (SiteSettings.engagement.announcementBar). Plain text only, the
   organization's own: no HTML, no release marker, no working placeholder
   text. Approval needs at least one message. */
const own = (max: number) => text(max).refine((s) => workingTextFindings(s).length === 0, "must be the organization's own text, not working placeholder text");

export const AnnouncementBarItem = z.strictObject({
  id: EntityId,
  text: own(140),
  link: z.strictObject({ label: own(40), href: InternalPath }).optional(),
});
export type AnnouncementBarItem = z.infer<typeof AnnouncementBarItem>;

const { releaseMarker: _internal, ...barFields } = recordFields;

export const AnnouncementBar = z
  .strictObject({
    ...barFields,
    id: z.literal("announcement-bar"),
    items: z.array(AnnouncementBarItem).max(10),
  })
  .superRefine((bar, ctx) => {
    const seen = new Set<string>();
    bar.items.forEach((item, i) => {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", path: ["items", i, "id"], message: "is already used by another message" });
      seen.add(item.id);
    });
  });
export type AnnouncementBar = z.infer<typeof AnnouncementBar>;

/* What an owner cannot approve (or publish): a bar without a message. */
export const announcementBarApprovalProblems = (bar: Pick<AnnouncementBar, "items">): { path: string; message: string }[] =>
  bar.items.length > 0 ? [] : [{ path: "items", message: "at least one message is required before approval" }];

/* The POPUP as the CMS manages it (M22): ONE record per organization, in
   the `Popup` shape above, with the rules the website's popup
   (apps/web components/SitePopup) needs on top — what it cannot draw is
   refused rather than silently ignored:
     · the call to action leads to a page of this site (the popup links
       with the site's router; the build checks the page exists)
     · no `includePaths`, `startsAt` or `endsAt`: the popup has neither a
       page allow-list nor a time window. Schedule its publication to
       start it; switch it off, archive it or publish a change to end it
     · no release marker, and the organization's own words — no working
       placeholder text
   Its photograph comes from the media library and must be described
   (alt text) — checked by the API and the snapshot, which see the
   media. `key` is what a visitor's "closed" is remembered against:
   change it to show the popup again to everyone who closed it. */
export const POPUP_RECORD_ID = "site-popup";
const SITE_PATH = /^\/(?!\/)[^\s?#\\]*$/;
export function popupCmsProblems(popup: Partial<Popup> & { releaseMarker?: unknown }): { path: string; message: string }[] {
  const problems: { path: string; message: string }[] = [];
  if (popup.cta && !SITE_PATH.test(popup.cta.href)) problems.push({ path: "cta.href", message: "must be a page of this site, like /appeals — the popup never links elsewhere" });
  for (const field of ["includePaths", "startsAt", "endsAt"] as const)
    if (popup[field] !== undefined) problems.push({ path: field, message: "is not supported by the website's popup — schedule its publication, or switch it off, instead" });
  if (popup.releaseMarker !== undefined) problems.push({ path: "releaseMarker", message: "release markers are internal to source content and are never set in the CMS" });
  for (const field of ["kicker", "heading", "highlight", "body", "dismissLabel"] as const) {
    const value = popup[field];
    if (typeof value === "string" && workingTextFindings(value).length) problems.push({ path: field, message: "must be the organization's own text, not working placeholder text" });
  }
  if (popup.cta && workingTextFindings(popup.cta.label).length) problems.push({ path: "cta.label", message: "must be the organization's own text, not working placeholder text" });
  return problems;
}

/* HIGHLIGHTS — the story strip over the navbar (M23): ONE record per
   organization naming, in order, the appeals whose circles it shows (at
   most STORY_STRIP_LIMIT, the website's own limit). It decides WHICH
   appeals and in WHAT ORDER; each circle's label and photograph stay the
   appeal's own (Appeal.highlight: a shorter label, another photo — absent,
   the appeal's title and photo). Every appeal it names must be published
   in the same snapshot. Without a published strip the website keeps
   today's rule: highlighted appeals, newest first. Whether the strip shows
   at all is SiteSettings.engagement.storyStrip. Approval needs at least
   one appeal. */
export const STORY_STRIP_LIMIT = 4;

export const StoryStrip = z
  .strictObject({
    ...barFields,
    id: z.literal("story-strip"),
    appealIds: z.array(EntityId).max(STORY_STRIP_LIMIT),
  })
  .refine((s) => new Set(s.appealIds).size === s.appealIds.length, { path: ["appealIds"], message: "an appeal is chosen twice" });
export type StoryStrip = z.infer<typeof StoryStrip>;

export const storyStripApprovalProblems = (strip: Pick<StoryStrip, "appealIds">): { path: string; message: string }[] =>
  strip.appealIds.length > 0 ? [] : [{ path: "appealIds", message: "at least one appeal is required before approval" }];
