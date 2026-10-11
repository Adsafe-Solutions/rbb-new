/* Site-wide notices — the announcement bar over the header
   (components/AnnouncementBar) and the on-screen popup
   (components/SitePopup).

   ON / OFF: each has `enabled` below. A deployment can override it
   without touching this file — VITE_ANNOUNCEMENT_BAR / VITE_SITE_POPUP
   = "true" | "false" (config/sections.js). An empty `items` list also
   hides the bar.

   The messages below are SAMPLE copy pointing at the site's sample
   appeals and events; each carries an internal `releaseMarker` (never
   shown) so a production release stays blocked until RBB writes its
   own. Keep bar messages SHORT — one line on a phone. */
import { WORKING_PHOTOS } from "./photos.js";
import { APPEALS, appealPath } from "./appeals.js";
import { EVENTS, eventPath } from "./media.js";

const MARKER = "Sample event — sample announcement";

/* A message that points at one appeal or one event is shown only while
   that page exists. A build from the CMS's published snapshot replaces
   the sample appeals and events, and a message must never lead to a
   missing page. Any other link is the site's own route and always kept. */
const APPEAL_PAGE = /^\/appeals\/(emergency|campaigns)\/[^/]+$/;
const EVENT_PAGE = /^\/media\/events\/[^/]+$/;
const linkExists = (to) =>
  APPEAL_PAGE.test(to) ? APPEALS.some((a) => appealPath(a) === to) : EVENT_PAGE.test(to) ? EVENTS.some((e) => eventPath(e) === to) : true;

export const ANNOUNCEMENTS = {
  bar: {
    enabled: true,
    /* How long each message stays, in ms. */
    interval: 5000,
    label: "Announcements",
    previous: "Previous announcement",
    next: "Next announcement",
    close: "Hide announcements",
    items: [
      {
        id: "emergency-appeal",
        text: "Our emergency appeal is open — help families with essentials.",
        link: { label: "Give now", to: "/appeals/emergency/emergency-appeal-01" },
      },
      {
        id: "community-dinner",
        text: "Join us for a community dinner on 14 November.",
        link: { label: "See events", to: "/media/events/community-dinner-november" },
      },
      {
        id: "volunteer",
        text: "New volunteers welcome — find a role that suits you.",
        link: { label: "Volunteer", to: "/get-involved/volunteer" },
      },
    ]
      .filter((item) => linkExists(item.link.to))
      .map((item) => ({ ...item, releaseMarker: MARKER })),
  },

  popup: {
    enabled: true,
    /* Change the id to show a NEW popup to visitors who closed the last
       one: "closed" is remembered per id. */
    id: "events-autumn-2026",
    /* Seconds after arrival before it opens. */
    delayMs: 6000,
    /* "session": once per visit (closing it keeps it closed until the
       browser tab is closed). "once": once per visitor, remembered. */
    frequency: "session",
    /* Never opens on these pages (and their sub-pages). */
    excludePaths: ["/contact", "/privacy", "/terms", "/donation-policy"],
    kicker: "What's on",
    heading: "New events are open for registration.",
    highlight: "registration.",
    body: "Community dinners, family reading afternoons and volunteer mornings — find something near you and save your place.",
    image: WORKING_PHOTOS.foodPrep,
    cta: { label: "Explore events", to: "/media/events" },
    dismiss: "Maybe later",
    close: "Close",
    releaseMarker: MARKER,
  },
};

export default ANNOUNCEMENTS;
