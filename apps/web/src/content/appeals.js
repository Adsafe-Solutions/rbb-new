/* Appeals — the giving side of the site. ONE source for every appeal:
   the header's Appeals menu, the routes, the /appeals hub, each kind's
   list page and each appeal's own page all read from here, so adding an
   appeal is adding a record below — it gets a URL, a menu entry and a
   page built from the one shared template (pages/Appeal).

   Two kinds, in the order the menu shows them:
     emergency   Emergency Response — time-bound responses
     campaigns   Campaigns — longer-running pushes behind one aim

   The four appeals below are SAMPLE content, written to read naturally
   so the pages can be reviewed as they will look; replace them with
   RBB's own before launch (their internal `releaseMarker` keeps a
   production release blocked until then).

   ⚠ No target, amount raised, number of donors, cost-per-outcome or
   deadline here until RBB supplies and approves them. The
   donation form on each page is the shared one (content/donation.js);
   it does not designate a gift to the appeal, so no copy says it does.

   The appeals are CONTENT-CONTRACT RECORDS (packages/content-schema
   `Appeal`): plain serializable data — images by media id, sections as
   typed blocks — exactly what the CMS will store and the API will serve.
   src/contract/appeals.js turns each into the view model the components
   read, and the build checks every record against the contract
   (src/contract/conformance.js). Publication state is the contract's:
     "draft" | "published" | "archived" — only "published" is listed.
   Sample content is marked by its internal `releaseMarker`, not by its
   status. */

import { ORG_ID } from "../contract/org.js";
import { appealView } from "../contract/appeals.js";
import { withoutTrailingSlash } from "../lib/paths.js";

export const APPEAL_KINDS = [
  {
    id: "emergency",
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
];

/* One appeal record (packages/content-schema `Appeal`):
     { id, orgId, schemaVersion, status, releaseMarker?, kind, slug,
       title, summary, imageId, highlight?, sections: [block] }
   `kind` is "emergency" or "campaign". `sections` are typed blocks with
   stable ids: the appeal page draws a `statement` (why it matters) and
   `numberedCards` (how support helps).

   `highlight` puts the appeal in the story circles over the navbar
   (components/StoryStrip) — {} or { label?, imageId? } for a shorter
   circle label / a different photo. Up to APPEAL_STORIES.limit appeals
   show, in this list's order; the rest are ignored. RBB's own appeals
   only: until it launches one, this list is empty and each kind says
   what it is for (`empty` above). */
/* INTERNAL, never shown: keeps release:check blocked until RBB's own
   appeals replace these sample ones (src/lib/releaseMarkers.js). */
const MARKER = "Sample event — sample appeal";

export const APPEAL_RECORDS = [
  {
    id: "emergency-appeal-01",
    orgId: ORG_ID,
    schemaVersion: 1,
    status: "published",
    releaseMarker: MARKER,
    kind: "emergency",
    slug: "emergency-appeal-01",
    title: "Emergency Appeal 01",
    summary:
      "When a crisis strikes, families need essentials quickly. This appeal funds an immediate response — and support as they recover.",
    imageId: "working-relief-packing",
    highlight: { label: "Emergency Relief" },
    sections: [
      {
        id: "situation",
        type: "statement",
        enabled: true,
        version: 1,
        data: {
          heading: "The situation",
          body: [
            "When a crisis strikes, the first days matter most. Families can lose access to food, clean water and shelter almost overnight.",
            "This appeal supports an immediate response alongside local partners, and stays with families through the weeks of recovery that follow.",
          ],
        },
      },
      {
        id: "response",
        type: "numberedCards",
        enabled: true,
        version: 1,
        data: {
          heading: "How your support helps",
          items: [
            { title: "Immediate essentials for families" },
            { title: "Safe water and hygiene supplies" },
            { title: "Support as families recover and rebuild" },
          ],
        },
      },
    ],
  },
  {
    id: "emergency-appeal-02",
    orgId: ORG_ID,
    schemaVersion: 1,
    status: "published",
    releaseMarker: MARKER,
    kind: "emergency",
    slug: "emergency-appeal-02",
    title: "Emergency Appeal 02",
    summary: "Support for communities facing a sudden emergency, delivered with care and with local partners.",
    imageId: "working-aid-boxes",
    highlight: { label: "Family Essentials" },
    sections: [
      {
        id: "situation",
        type: "statement",
        enabled: true,
        version: 1,
        data: {
          heading: "The situation",
          body: [
            "Emergencies hit hardest where support is already stretched. This appeal helps communities meet urgent needs while longer-term help is organised.",
            "Everything is planned with the people affected, so support reaches those who need it most.",
          ],
        },
      },
      {
        id: "response",
        type: "numberedCards",
        enabled: true,
        version: 1,
        data: {
          heading: "How your support helps",
          items: [
            { title: "Food and household essentials" },
            { title: "Health and hygiene support" },
            { title: "Help reconnecting families with services" },
          ],
        },
      },
    ],
  },
  {
    id: "campaign-01",
    orgId: ORG_ID,
    schemaVersion: 1,
    status: "published",
    releaseMarker: MARKER,
    kind: "campaign",
    slug: "campaign-01",
    title: "Campaign 01",
    summary: "A campaign to widen access to learning, so more children can read, learn and keep learning.",
    imageId: "working-reading-circle",
    highlight: { label: "Education for All" },
    sections: [
      {
        id: "situation",
        type: "statement",
        enabled: true,
        version: 1,
        data: {
          heading: "Why this campaign",
          body: [
            "Too many children still miss out on learning because of cost, distance or a lack of books and teachers.",
            "This campaign supports reading clubs, learning materials and teachers — practical steps that open the door to learning.",
          ],
        },
      },
      {
        id: "response",
        type: "numberedCards",
        enabled: true,
        version: 1,
        data: {
          heading: "How your support helps",
          items: [
            { title: "Books and learning materials" },
            { title: "Reading clubs and after-school sessions" },
            { title: "Support for teachers" },
          ],
        },
      },
    ],
  },
  {
    id: "campaign-02",
    orgId: ORG_ID,
    schemaVersion: 1,
    status: "published",
    releaseMarker: MARKER,
    kind: "campaign",
    slug: "campaign-02",
    title: "Campaign 02",
    summary: "A campaign for clean water close to home — and the care that keeps it flowing.",
    imageId: "working-water-pump",
    highlight: { label: "Clean Water" },
    sections: [
      {
        id: "situation",
        type: "statement",
        enabled: true,
        version: 1,
        data: {
          heading: "Why this campaign",
          body: [
            "Clean water close to home changes everything: health, time for school and work, and dignity.",
            "This campaign supports repairs to community water points and training local volunteers to look after them.",
          ],
        },
      },
      {
        id: "response",
        type: "numberedCards",
        enabled: true,
        version: 1,
        data: {
          heading: "How your support helps",
          items: [
            { title: "Repairs to community water points" },
            { title: "Training for local caretakers" },
            { title: "Hygiene awareness sessions" },
          ],
        },
      },
    ],
  },
];

/* The published appeals, as the components read them. */
export const APPEALS = APPEAL_RECORDS.filter((record) => record.status === "published").map(appealView);

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
export const appealByPath = (to) => APPEALS.find((a) => appealPath(a) === withoutTrailingSlash(to));

/* ---------------- Page copy ----------------
   PROPOSED interface copy — what each page is, never a claim. */
export const APPEALS_PAGES = {
  hub: {
    kicker: "Donate",
    heading: "Appeals",
    body: "Choose an emergency appeal or a campaign to support — or give where support is needed most.",
    listCta: "See all",
    general: { kicker: "Give where it's needed most" },
  },
  appeal: {
    more: { kicker: "More appeals", heading: "Other appeals" },
  },
};

export default APPEALS;
