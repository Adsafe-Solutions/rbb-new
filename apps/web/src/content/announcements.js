/* Site-wide notices — the announcement bar over the header
   (components/AnnouncementBar) and the on-screen popup
   (components/SitePopup).

   ON / OFF: each has `enabled` below. A deployment can override it
   without touching this file — VITE_ANNOUNCEMENT_BAR / VITE_SITE_POPUP
   = "true" | "false" (config/sections.js). An empty `items` list also
   hides the bar.

   2026-10-13: the messages, the popup's content and both switches are
   the CMS's (Admin → Announcements, Popups; Settings → Engagement): the
   published snapshot sets them. Without one, nothing shows. What stays
   here is the interface wording and the popup's behaviour defaults. */

export const ANNOUNCEMENTS = {
  bar: {
    enabled: true,
    /* How long each message stays, in ms. */
    interval: 5000,
    label: "Announcements",
    previous: "Previous announcement",
    next: "Next announcement",
    close: "Hide announcements",
    /* The published messages, in order. */
    items: [],
  },

  popup: {
    /* Off until the published settings switch it on (with its content). */
    enabled: false,
    /* The popup's key: "closed" is remembered per id. */
    id: "",
    /* Seconds after arrival before it opens. */
    delayMs: 6000,
    /* "session": once per visit (closing it keeps it closed until the
       browser tab is closed). "once": once per visitor, remembered. */
    frequency: "session",
    /* Never opens on these pages (and their sub-pages). */
    excludePaths: ["/contact", "/privacy", "/terms", "/donation-policy"],
    kicker: null,
    heading: "",
    highlight: null,
    body: "",
    image: null,
    cta: null,
    dismiss: "Maybe later",
    close: "Close",
    releaseMarker: null,
  },
};

export default ANNOUNCEMENTS;
