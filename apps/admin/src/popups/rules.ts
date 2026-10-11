/* The popup editor's pure rules (M22), unit-tested under plain Node
   (scripts/test/popups.test.mjs). The API enforces every one of them;
   these keep the editor from offering what it would refuse, and write no
   wording: a new popup's words are empty until someone types them. */

export const PARTS = ["key", "kicker", "heading", "highlight", "body", "imageId", "cta", "dismissLabel", "delayMs", "frequency", "excludePaths"] as const;

export interface PopupDraft {
  key: string;
  kicker: string;
  heading: string;
  highlight: string;
  body: string;
  imageId: string;
  ctaLabel: string;
  ctaHref: string;
  dismissLabel: string;
  delaySeconds: number;
  frequency: "session" | "once";
  excludeText: string;
}

export interface PopupPayload {
  key: string;
  kicker?: string;
  heading: string;
  highlight?: string;
  body: string;
  imageId: string;
  cta: { label: string; href: string };
  dismissLabel: string;
  delayMs: number;
  frequency: "session" | "once";
  excludePaths: string[];
}

/* How the website's popup behaves today (content/announcements.js), as a
   new popup's starting settings — behaviour, never words. */
export const STARTING_EXCLUDES = ["/contact", "/privacy", "/terms", "/donation-policy"];
export const newKey = (now = new Date()) => `popup-${now.toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;

export function draftOf(record: Partial<PopupPayload> | null): PopupDraft {
  return {
    key: record?.key ?? newKey(),
    kicker: record?.kicker ?? "",
    heading: record?.heading ?? "",
    highlight: record?.highlight ?? "",
    body: record?.body ?? "",
    imageId: record?.imageId ?? "",
    ctaLabel: record?.cta?.label ?? "",
    ctaHref: record?.cta?.href ?? "",
    dismissLabel: record?.dismissLabel ?? "",
    delaySeconds: Math.round((record?.delayMs ?? 6000) / 1000),
    frequency: record?.frequency ?? "session",
    excludeText: (record?.excludePaths ?? (record ? [] : STARTING_EXCLUDES)).join("\n"),
  };
}

export function payloadOf(d: PopupDraft): PopupPayload {
  const kicker = d.kicker.trim();
  const highlight = d.highlight.trim();
  return {
    key: d.key.trim(),
    ...(kicker && { kicker }),
    heading: d.heading.trim(),
    ...(highlight && { highlight }),
    body: d.body.trim(),
    imageId: d.imageId,
    cta: { label: d.ctaLabel.trim(), href: d.ctaHref.trim() },
    dismissLabel: d.dismissLabel.trim(),
    delayMs: d.delaySeconds * 1000,
    frequency: d.frequency,
    excludePaths: [...new Set(d.excludeText.split("\n").map((p) => p.trim()).filter(Boolean))],
  };
}

/* The parts that differ — what a save sends (null clears an optional one). */
export function changedParts(draft: PopupPayload, saved: PopupPayload | null): Record<string, unknown> {
  const a = draft as unknown as Record<string, unknown>;
  const b = (saved ?? {}) as Record<string, unknown>;
  return Object.fromEntries(PARTS.filter((p) => JSON.stringify(a[p] ?? null) !== JSON.stringify(b[p] ?? null)).map((p) => [p, a[p] ?? null]));
}

const SITE_PATH = /^\/(?!\/)[^\s?#\\]*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function popupProblems(d: PopupDraft): Map<string, string> {
  const p = payloadOf(d);
  const problems = new Map<string, string>();
  if (!SLUG.test(p.key)) problems.set("key", "Lowercase words joined by hyphens, like popup-2026-10.");
  if (!p.heading) problems.set("heading", "A heading is required.");
  if (p.highlight && !p.heading.includes(p.highlight)) problems.set("highlight", "The highlighted words must be part of the heading.");
  if (!p.body) problems.set("body", "A line is required.");
  if (!p.imageId) problems.set("imageId", "Choose a photograph from the media library.");
  if (!p.cta.label) problems.set("cta.label", "Button text is required.");
  if (!SITE_PATH.test(p.cta.href)) problems.set("cta.href", "A page of this website, like /appeals. Never another site.");
  if (!p.dismissLabel) problems.set("dismissLabel", "The close-button text is required.");
  if (!Number.isInteger(d.delaySeconds) || d.delaySeconds < 0 || d.delaySeconds > 60) problems.set("delayMs", "Between 0 and 60 seconds.");
  const bad = p.excludePaths.find((x) => !SITE_PATH.test(x));
  if (bad) problems.set("excludePaths", `“${bad}” is not a path on this site, like /contact.`);
  else if (p.excludePaths.length > 50) problems.set("excludePaths", "At most 50 pages.");
  return problems;
}
