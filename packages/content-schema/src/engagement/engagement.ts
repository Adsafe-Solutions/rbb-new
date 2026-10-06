import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { IsoDateTime, MediaId, Slug, text } from "../common/primitives.ts";
import { InternalPath, Link } from "../common/link.ts";

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
