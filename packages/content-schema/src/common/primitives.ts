import { z } from "zod";

/* The building blocks every content schema uses. Everything here describes
   JSON data: strings, numbers, booleans, arrays and plain objects. */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/* Text is rendered as text, never as markup — so a value that looks like
   an HTML tag is a mistake (pasted markup) or an attempt, either way not
   content. */
const HTML_TAG = /<\/?[a-z][^>]*>/i;

/* Lowercase words joined by hyphens — the rule the web's content
   validator already applies to slugs. Used in URLs. */
export const Slug = z.string().max(120).regex(SLUG, "must be lowercase words joined by hyphens");

/* The organization a record belongs to. One per deployment today. */
export const OrgId = z.string().max(64).regex(SLUG, "must be lowercase words joined by hyphens");

/* A record's stable identity. Never a position in a list. */
export const EntityId = z.string().regex(ID, "must be letters, digits, '-' or '_' (max 128)");

/* A reference to a Media record — an id, never a URL or a file path, so
   where the file lives (a local asset today, R2 later) is the resolver's
   business, not the content's. */
export const MediaId = z.string().regex(ID, "must be a media id, not a URL or path");

/* Calendar date "2026-11-14" and instant "2026-11-14T18:30:00Z". */
export const IsoDate = z.iso.date();
export const IsoDateTime = z.iso.datetime({ offset: true });

/* A time of day as the site writes it today: "6:30 PM". */
export const TimeOfDay = z.string().regex(/^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/, 'must be a time like "6:30 PM"');

/* A YouTube video id (the site plays films from YouTube in place). */
export const YouTubeId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "must be an 11-character YouTube video id");

/* One line or paragraph of plain text, at most `max` characters. */
export const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0, "must not be empty")
    .refine((s) => !HTML_TAG.test(s), "must be plain text, not HTML");

/* Paragraphs of plain text, in order. */
export const Paragraphs = z.array(text(2000)).min(1);

/* INTERNAL, never shown: marks a record as sample or working content, so
   the release stays blocked until the organization's own content replaces
   it (apps/web/src/lib/releaseMarkers.js). */
export const ReleaseMarker = text(200);
