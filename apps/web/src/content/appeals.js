/* Appeals — the giving side of the site. ONE source for every appeal:
   the header's Appeals menu, the routes, the /appeals hub, each kind's
   list page and each appeal's own page all read from here, so adding an
   appeal is publishing one in the CMS — it gets a URL, a menu entry and a
   page built from the one shared template (pages/Appeal).

   Three kinds, in the order the menu shows them (each its own
   subsection; `cms` is the content contract's AppealKind):
     emergency   Emergency Response — time-bound responses
     campaigns   Campaigns — longer-running pushes behind one aim
     special     Special Appeals — one-off appeals for a particular need
                 (2026-10-17, RBB's request)

   2026-10-13: the appeals are the CMS's only (Admin → Appeals): the
   published snapshot sets APPEALS, as the view model the components read
   (scripts/snapshot-adapter.mjs). The sample appeal records this file
   used to hold — and src/contract/appeals.js, which turned them into
   views — were removed once the live snapshot was shown to replace them.

   ⚠ No target, amount raised, number of donors, cost-per-outcome or
   deadline here until RBB supplies and approves them. The
   donation form on each page is the shared one (content/donation.js);
   it does not designate a gift to the appeal, so no copy says it does.
 */

import { withoutTrailingSlash } from "../lib/paths.js";

export const APPEAL_KINDS = [
  {
    id: "emergency",
    cms: "emergency",
    label: "Emergency Response",
    to: "/appeals/emergency",
    icon: "shield",
    kicker: "Emergency response",
    /* PROPOSED interface copy: what the list is, not what RBB has done. */
    body: "Appeals that respond to an urgent need, for as long as that need lasts.",
    description: "Emergency appeals from Rising Beyond Borders.",
    empty: {
      text: "There is no emergency appeal open right now. When Rising Beyond Borders launches an emergency response, it will be listed here with what is happening and how support helps. You can still give where support is needed most.",
      cta: { label: "Give where it's needed most", to: "/appeals#donate" },
    },
  },
  {
    id: "campaigns",
    cms: "campaign",
    label: "Campaigns",
    to: "/appeals/campaigns",
    icon: "fundraise",
    kicker: "Campaigns",
    body: "Longer-running campaigns, each built around one aim within the four program areas.",
    description: "Campaigns from Rising Beyond Borders.",
    empty: {
      text: "No campaign is running right now. Each campaign is built around one aim within our four program areas — education, health and wellbeing, livelihoods and community support — and will be listed here when it launches.",
      cta: { label: "Explore Our Work", to: "/work" },
    },
  },
  {
    id: "special",
    cms: "special",
    label: "Special Appeals",
    to: "/appeals/special",
    icon: "donate",
    kicker: "Special appeals",
    /* PROPOSED interface copy: what the list is, never a claim. */
    body: "Appeals raised for one particular need, each open for as long as that need lasts.",
    description: "Special appeals from Rising Beyond Borders.",
    empty: {
      text: "There is no special appeal open right now. When Rising Beyond Borders launches one, it will be listed here with what it is for and how support helps. You can still give where support is needed most.",
      cta: { label: "Give where it's needed most", to: "/appeals#donate" },
    },
  },
];

/* One appeal record (packages/content-schema `Appeal`):
     { id, orgId, schemaVersion, status, releaseMarker?, kind, slug,
       title, summary, imageId, highlight?, sections: [block] }
   `kind` is "emergency", "campaign" or "special". `sections` are typed blocks with
   stable ids: the appeal page draws a `statement` (why it matters) and
   `numberedCards` (how support helps).

   `highlight` puts the appeal in the story circles over the navbar
   (components/StoryStrip) — {} or { label?, imageId? } for a shorter
   circle label / a different photo. Up to APPEAL_STORIES.limit appeals
   show, in this list's order; the rest are ignored. RBB's own appeals
   only: until it launches one, this list is empty and each kind says
   what it is for (`empty` above). */
/* The published appeals, as the components read them. */
export const APPEALS = [];

/* ---------------- Lookups ---------------- */
/* The story circles over the navbar (components/StoryStrip). ON / OFF
   here; a deployment can override with VITE_STORY_STRIP = "true" |
   "false" (config/sections.js). With no appeal marked `story`, the strip
   does not render at all. */
export const APPEAL_STORIES = {
  enabled: true,
  limit: 4,
  label: "Featured appeals",
  /* A published Highlights strip (M23) sets this: the ids of the appeals
     it shows, in its order. null: the site's own rule below. */
  order: null,
};

/* The appeals in the strip: `story`-marked, in order, at most `limit` —
   the published strip's appeals in ITS order when there is one (a
   published snapshot sets APPEAL_STORIES.order, at build time or in the
   browser), never one it names that is not here. */
export const storyAppeals = () =>
  (APPEAL_STORIES.order ? APPEAL_STORIES.order.map((id) => APPEALS.find((a) => a.id === id)).filter((a) => a?.story) : APPEALS.filter((a) => a.story))
    .slice(0, APPEAL_STORIES.limit)
    .map((a) => ({
      id: a.id,
      label: a.story.label ?? a.title,
      image: a.story.image ?? a.image,
      to: appealPath(a),
    }));

export const appealKind = (id) => APPEAL_KINDS.find((k) => k.id === id);
export const appealKindByPath = (to) => APPEAL_KINDS.find((k) => k.to === withoutTrailingSlash(to));
export const appealPath = (appeal) => `${appealKind(appeal.kind).to}/${appeal.id}`;
export const appealsOf = (kind) => APPEALS.filter((a) => a.kind === kind);
/* The appeals of a CMS kind ("campaign" lists the "campaigns" subsection). */
export const appealsOfCmsKind = (cms) => appealsOf(APPEAL_KINDS.find((k) => k.cms === cms)?.id);
export const appealByPath = (to) => APPEALS.find((a) => appealPath(a) === withoutTrailingSlash(to));

/* ---------------- Page copy ----------------
   PROPOSED interface copy — what each page is, never a claim. */
export const APPEALS_PAGES = {
  hub: {
    kicker: "Donate",
    heading: "Appeals",
    body: "Choose an emergency appeal, a campaign or a special appeal to support — or give where support is needed most.",
    listCta: "See all",
    general: { kicker: "Give where it's needed most" },
  },
  appeal: {
    more: { kicker: "More appeals", heading: "Other appeals" },
  },
};

export default APPEALS;
