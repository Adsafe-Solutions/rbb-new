# Working in this repo

React 18 + Vite 7 + React Router 7 + **Tailwind v4**.

## Design system

`src/styles/theme.css` is the single source of truth. It is a Tailwind v4
`@theme` block, so every variable in it becomes a utility automatically.
`src/styles/variables.css` mirrors the same tokens as plain custom properties
for hand-written CSS — **when a token changes, change it in both.**

There is no `tailwind.config.js` and no `postcss.config.js`. Tailwind v4 runs
as a Vite plugin.

### Gotchas that have already bitten

**`--spacing-<key>` inside `@theme` redefines Tailwind's spacing scale.** The
original token export carried `--spacing-8: 8px` … `--spacing-48: 48px`, which
would have silently turned `p-8` from 32px into 8px across the whole app while
leaving `p-6` and `p-10` on the default scale — a scale where `p-6` and `p-24`
are both 24px and `p-8` is smaller than `p-6`. The design's base unit is 4px
and Tailwind's default scale is also 4px, so the tokens already existed
natively. The px-named aliases live in `variables.css` as `--space-*`, where
they collide with nothing. **Do not move them back into `@theme`.**

**Interpolated class names generate nothing.** Tailwind scans for literal
strings. ``cx(`bg-${color.token}`)`` compiles, renders, and shows a
transparent box. Keep full class strings in a lookup map.

**`overflow-x-clip` on `body`, not `overflow-x-hidden`.** Decorative artwork
overhangs the viewport by design. `hidden` would make `body` a scroll
container and silently break `position: sticky` for the header. The same trap
applies anywhere else you reach for it — the hero band clips its own
decorations with `overflow-hidden` on the `<section>`, which is safe because
it is the band that becomes the scroll container, not `body`.

**Everything a reveal hides is hidden by CSS, before the first paint.**
The page arrives pre-rendered, so its content paints before React
hydrates: hiding an element from JavaScript means it appears, vanishes and
comes back. The `.js [data-anim]` rules in `index.css` are what hide it,
and `prefers-reduced-motion` unhides it in CSS too — so content never
depends on the animation engine having run. The corollary: an element
given a motion attribute that is never scanned would stay invisible, which
is why `MotionProvider` re-scans when new nodes appear.

**Motion is one system, driven by attributes.** `src/animations/` — Lenis
for smooth scrolling, GSAP + ScrollTrigger + SplitText for everything
else. A component never imports GSAP or writes a tween; it marks up what a
piece of content IS (`.reveal`, `data-anim="sequence"`, `data-anim-stagger`,
`data-split`, `data-parallax`, `data-count`) and `animations/reveals.js`
decides how that behaves. The vocabulary is documented there; the
durations, curves and distances are in `animations/config.js`, mirrored
for hand-written CSS as `--motion-*` in `variables.css`.

**`--motion-*`, never `--ease-*` or `--duration-*`, and never in
`@theme`.** Tailwind v4 owns both of those namespaces — the same trap
`--spacing-8` sets for `p-8`.

**Above the fold is CSS's; everything you scroll to is the scanner's.**
The motion system binds after React hydrates — ~1.9s on a throttled
phone — so a hero animated through it cannot appear before then. Heroes
use the `data-enter-*` rules in `index.css`, which run at first paint.
Driven by the scanner, the homepage hero's own paragraph was the page's
Largest Contentful Paint at 2.3s; in CSS it is ~1.4s.

**Scroll the page through `animations/lenis.js`**, not `window.scrollTo`.
A native jump lands the page somewhere Lenis is still animating towards and
gets undone. `jumpTo` / `glideTo` are the native calls when Lenis is off.

### Gaps between cards

Three rules, as utilities (tokens in `variables.css`, utilities in
`index.css`, live on `/design-system`). Pick by what the cards are:

- `gap-cards` — sibling cards in a grid, row or carousel (16px → 24px at md)
- `gap-tiles` — pieces of one composition, e.g. collage photos (12px → 16px)
- `gap-stack` — full-width cards in a vertical list, e.g. FAQ (12px)

Never `gap-6` / `gap-8` between cards. Gutters between a text column and
its photograph in a split layout are page layout, not card gaps.

### One content source (Document 27)

**Content is not an environment. Infrastructure is.** There is one set of
content files under `src/content/`, one image set under `src/assets/`, and
one build. `npm run dev` and `npm run build` show the same complete site.
There is no staging content mode, no `src/content/demo/`, no
`VITE_CONTENT_MODE`, no `build:staging`.

Much of that content is SAMPLE content while RBB's own words are written:
team profiles, stories, projects, the homepage timeline and film, Media
Center items, appeals, stock photographs. Sections stay populated, but
VISIBLE text never labels itself as demo (client decision, 2026-10-06) —
no "Demo text —", "(demo)", "Sample profile". Write samples as natural
NGO copy with no real people, places or figures. Each sample record
carries an internal `releaseMarker` (rendered only as a hidden
`data-release-marker`), so the release stays blocked until RBB replaces
it; see `docs/WORKING_CONTENT.md`. A few things never get a sample:
impact figures, financial percentages and any DOCUMENT. Those stay empty
or `pending-review` until RBB supplies them.

What the build enforces splits in two (`scripts/production-gate.mjs`):

- **Safety** — credentials, forbidden files, dev-catalogue routes. Always
  fails the build. Also `src/content/validate.js`, on the content files.
- **Readiness** — where sample records (their `releaseMarker`s) and
  working photographs are still published. Never fails a build; it is
  written to `build-meta/content-readiness.json` and blocks
  PRODUCTION-CONTENT-READY in `npm run release:status` (approvals in
  `release/approvals.mjs`, docs/RELEASE_READINESS.md). A count above 0 is
  expected until RBB's content replaces the samples.

Environments still differ in INFRASTRUCTURE: email (off/test/live),
payments (off/test/live), analytics, secrets and indexing. Deploy/launch:
`docs/LAUNCH_RUNBOOK.md` — `npm run smoke`, `npm run release:package`.
Host adapters use only `createServerApp` (`server/app.mjs`); no host is
chosen yet — `docs/HOST_CONFIGURATION.md`.

### The CMS's published snapshot

`npm run build` first runs `scripts/published-snapshot.mjs`. With
`RBB_SNAPSHOT_URL` set, it fetches the API's published snapshot once, and
the `rbb-published-snapshot` Vite plugin sets the mapped exports in
`brand.js`, `site.js` and `contact.js`. This happens in the client and
server builds alike, so the HTML and the hydrated page agree. The mapping
and its reasons are in `scripts/snapshot-adapter.mjs`. Without the URL,
nothing changes: the source content is the site, byte for byte.

**The runtime snapshot** (`docs/PUBLISHING.md` "Runtime snapshot"): a
build with the URL also asks the API for the latest published snapshot
in the browser, BEFORE the content modules load. In such a build the
plugin does not append assignments; every target module ends with a call
to `applyRuntimeOverrides` (`src/lib/runtimeOverrides.js`), and
`src/lib/runtimeBoot.js` — awaited at the top level, which every content
module waits on through that hook — decides whether the baked values
(compiled in as `__RBB_BAKED_OVERRIDES__`) or a newer, fully checked
snapshot are applied. So anything derived from the content AS A MODULE
LOADS (`SITE.name`, the footer's `SOCIALS`, `PAGES`, `BUILT` in App.jsx,
`SECTIONS`) follows the chosen snapshot, as it follows the build's
assignments. A newer snapshot means `main.jsx` renders afresh instead
of hydrating. Never read the snapshot from a component, and never add a
runtime fetch anywhere else: one decision, before the modules load, is
what keeps every page consistent. `RBB_SNAPSHOT_RUNTIME=off` builds the
fully static site.

A snapshot that carries content collections also replaces `NEWS`, `BLOGS`
and `EVENTS` in `media.js` with the published CMS records. Their `body` and
`about` are structured rich text, which the article and event pages render
through `components/RichText`; source items stay plain paragraph strings.
A collection the snapshot doesn't carry keeps its source items.

A snapshot's published appeals replace `APPEALS` (`appeals.js`), and a
published general donation page fills `PUBLISHED_GENERAL_DONATION`
(`donation.js`), which `generalDonation()` prefers. A page whose
`checkout` the build can draw (`integrations/donations/DonationCheckout`
`checkoutAvailable`: Givebutter, and `VITE_GIVEBUTTER_ACCOUNT_ID` set)
shows Givebutter's widget in the form slot. Every other page shows
DonationForm.

A snapshot's published homepage fills `PUBLISHED_HOMEPAGE`
(`homepage.js`). `pages/Home` then draws its blocks through
`pages/Home/CmsHome.jsx`: an explicit type → component table, reusing the
source homepage's components. A build without one draws the source
homepage, unchanged. The About page works the same way
(`PUBLISHED_ABOUT`, `pages/About/CmsAbout.jsx`, one shared tone rule in
`lib/bandTones.js`). The snapshot's team replaces `TEAM_MEMBERS` in its
source shape, with media-library photographs (`imageId`). Its published
programs replace `PROGRAMS` (`work.js`) the same way. The program routes,
the Our Work menu and the homepage cards all derive from `PROGRAMS`, so
never hard-code the list of program areas anywhere else.

Published impact figures replace `IMPACT.metrics`. A `stats` block names
figures and `metricStats` resolves them, so never copy a figure into a
page. A published Impact page fills `PUBLISHED_IMPACT`
(`pages/Impact/CmsImpact.jsx`). Published transparency fills
`TRANSPARENCY` / `TRANSPARENCY_COPY` in their own shape. Trust panels read
`transparencyLinks()`; never list transparency rows by hand.

Published projects replace `PROJECT_RECORDS` and `PROJECTS` (`work.js`),
and published stories replace `STORIES` (`stories.js`), each in its source
shape. `STORY_SOURCE.cms` says which stories are the site's (M15): once the
CMS's are, they are the ONLY stories — never resolve a reference made
against the website's own stories (the source Impact page's
`IMPACT.stories` slugs) against CMS stories, or the other way round. The
source Impact page then shows its empty stories state, and the build warns;
a CMS Impact page names CMS stories by id, and a story it names that the
site does not show fails the build. `PROJECT_SOURCE.cms` does the same for
projects (M31.1): `false` by default, set by the build when the snapshot
carries published projects. While the projects are the CMS's but the
stories are still the website's own, a source story naming a source
project is a build WARNING, not an error, and its page shows no project
link (`lib/storyProjects.js`). A CMS story's missing project still fails
— the snapshot contract and `validate.js` both check it. The warning
approves nothing: sample stories keep their `releaseMarker` and still
block release readiness. A CMS story's `body` is structured rich text: render it through
`components/RichText`'s `RichBlock`, never as HTML. Media-library images
carry a `mediaId`; the validator and `publicImages` treat them as served
by the library, not the build.

A published Careers page fills `CAREERS` (`contact.js`) in its own shape.
`CAREERS.to` stays the site's address, and its roles stay the "verified"
roles the SEO rule counts.

A published Impact page's two sub-page blocks are never drawn on /impact:
`approach` sets `IMPACT.approach` (/impact/our-approach: intro and
principles) and `geography` sets
`IMPACT.geography` (/impact/where-we-work), both as nested targets. Our
Approach quotes the mission from the published About page's Mission &
Vision block, the source mission otherwise. A published How We Work page
sets `HOW_WE_WORK` and `HOW_WE_WORK.practices` (`about.js`); its posters,
closing ask and SEO stay the site's. Never write their words, countries or
regions on RBB's behalf (D11, D14), and an empty block approves nothing.
The Listen → Partner → Act → Sustain framework was rejected by RBB (D11):
never introduce it. Where We Work has no map (D14).

Website forms saved in the admin (2026-10-13, live when saved) arrive as
`content.forms` and set `PUBLISHED_FORMS` (`forms.js`). Pages ask for a
form with `formConfig(id)` — never `FORMS[id]` — so a saved form replaces
the built-in one; the Careers page draws `career-<role id>` forms beneath
its roles. A file field uploads through the API (`components/FileField`);
never post a file anywhere else.

Published policies (M19: privacy, terms, donation) are merged BY ID into
their records in `POLICIES` (`policies.js`), so the policy page, footer,
forms' privacy link, donation form and SEO follow. The id and route stay
the site's. A policy the snapshot does not carry keeps its source record.
`policies.js` itself is untouched, so a build without a published policy
is byte-identical. Never write policy text or dates on RBB's behalf, and
never treat a published policy as satisfying the `policies` release
approval.

Published Get Involved pages (M20) are assigned into `GET_INVOLVED` and
`GET_INVOLVED_PAGES` (`getInvolved.js`) through NESTED targets
(`GET_INVOLVED.paths` by id, `GET_INVOLVED_PAGES.hub.closing` …). Every
reader of the path records follows: menu, footer, cards, forms and SEO. A
path's title, route, icon, images and form stay the site's, and a call to
action is a target (`CTA_ROUTES`), never an address. Keep those nested
objects where they are; the build fails if one moves.

A published announcement bar (M21) replaces `ANNOUNCEMENTS.bar.items`.
In every snapshot build, the published settings'
`engagement.announcementBar` sets `ANNOUNCEMENTS.bar.enabled` and
`.interval`, though `VITE_ANNOUNCEMENT_BAR` still overrides `enabled`.
`content/validate.js` checks that every bar link is a pre-rendered page.

A published popup (M22) replaces `ANNOUNCEMENTS.popup`'s fields (its `key`
becomes the `id`; the parts it leaves out are cleared with null), and the
published `engagement.popup.enabled` sets `.enabled` in every snapshot
build. The popup's CTA must be one of the site's pages (`validate.js`),
and its photograph's origin is added to the CSP (`imageOrigins`).

A published Highlights strip (M23) sets `APPEAL_STORIES.order` (`null`
in the source), and `storyAppeals` in `appeals.js` follows that order
when it is set — the strip's appeals only, in its order — and the site's
own rule (highlighted appeals, list order) otherwise. It is a plain
value so the runtime snapshot can set it too; it used to be a build-time
rewrite of the expression. The published `engagement.storyStrip.enabled`
sets `APPEAL_STORIES.enabled` in every snapshot build.

**Keep those exports as `export const NAME = { … }` objects (or `[ … ]`
arrays for the collections, `APPEALS` and `POLICIES` included).** The build appends assignments to
them, and it fails loudly if one disappears.
Never fetch the CMS from a component: the build owns the snapshot. See
`docs/PUBLISHING.md`.

## Conventions

- One folder per component, one per page: `components/Button/Button.jsx`.
- Copy lives in `src/content/`, never inline in a component.
- Appeals are authored as content-contract records (`APPEAL_RECORDS`,
  `packages/content-schema`); `src/contract/` turns records into the view
  models components read, and the build checks every content record
  against the contract. Never import `src/contract/conformance.js` or
  `importers.js` from anything that ships to the browser.
- The sitemap is `src/content/nav.js`. Header, mobile menu, footer,
  breadcrumbs, routes and titles all read it. A page with real content
  registers in `BUILT` in `App.jsx`; anything else renders `Placeholder`.
- `src/config/env.js` is the only file that touches `import.meta.env`.
- Feature switches go in `src/config/sections.js` with an env override.
- Comments explain _why_, especially where the obvious approach is wrong.

## Design intent

The site is printed material, colour-blocked: an RBB reading of the
poster/flyer language in `docs/REFERENCE_WEBSITE_REVERSE_ENGINEERING.md`
(design principles only — never its copy, colours, font, assets or code).
`/design-system` and `/components` render the whole system live.

- **Default theme: Ivory & Cyan.** Every page starts in the "poster"
  palette (`<html data-theme="poster">` in `index.html`, mirrored by
  `content/site.js` `themes.default` — change both together; RBB's
  request, Oct 2026). RBB Blue (no attribute) and Midnight stay
  selectable in the theme switcher. The roles below describe the
  tokens, which every theme re-maps.
- **Three roles.** PAPER = a warm off-white ground (`--color-paper`
  `#f5efe6`, pending RBB approval) with white cards and prints on it;
  INK = Deep Trust Blue, for headings, borders, the footer and at most
  two strong-statement bands a page; ACCENT = Sky Blue (highlight
  blocks, hard shadows, the primary button, the closing call to action).
  Night (`#0a2647`) is a contrast token — text ON Sky Blue only, never
  a surface. Light Gray is for quiet UI fills. Growth Green is success
  states only. Colour token NAMES are historical (`bumble-honey`
  is Sky Blue, `bumble-ink` is Charcoal); read `theme.css`.
- **Tones, not colours.** Every band and card sets `data-tone` (`paper`,
  `white`, `card`, `ink`, `accent`) and components use
  `text-fg` / `text-copy` / `text-quiet` / `bg-pop` / `text-on-pop` /
  `border-edge` / `cast` — so one component is right on every ground.
  `Section` is a band; `OffsetCard` is the card every card is built on.
  No two neighbouring bands share a tone, and a page closes on Sky Blue
  (or paper) — never Deep Trust Blue, which would merge into the footer.
- **Sky Blue is never text on a light surface** (2.55:1). Emphasis there
  is Night type on a Sky Blue block — `HighlightText` / `.hl`. A
  highlight is chosen per page (`highlight="people"`), one word where
  possible, at most one or two a page; nothing highlights by default.
- **Type is the graphic.** DM Sans at 800–900, tight leading, through
  the `type-poster` … `type-meta` utilities (index.css). Poster,
  billboard and section titles are capitals; card headings
  (`type-card`) are sentence case, so the capitals keep meaning
  "headline". Copy in `src/content` stays sentence case.
- **Depth is a hard offset** (`cast-sm` / `cast` / `cast-lg`), never a
  blur. 2px borders. Radii: 16px cards, 12px buttons and fields, full
  pill for the header only. Tilt is for objects you look at — flyers,
  posters, tickets, photographs — never for grids people read and
  compare (projects, team, contact, figures, forms).
- **The mark is a graphic system** (`Mark`, `MarkStamp`, watermarks in
  `Section`) — enlarged, faint, double-printed, cropped by an edge;
  never stretched or redrawn.

### Gotchas in the poster system

**A tilt is `rotate`, and GSAP eats it.** The motion system tweens
`transform` and folds an element's individual `rotate`/`translate` into
it, then clears it — so a `tilt-*`, `-rotate-*` or `translate-*` utility
on an element that carries `.reveal` / `data-anim*` / is a child of
`data-anim-stagger` is lost. Tilt the card; reveal the wrapper around it.
Offset staggered grid items with margin, not translate.

**First-screen text never starts at opacity 0.** Use `data-enter-text`
for a hero's heading and intro, not `data-enter-item`. Chrome does not
count text painted at opacity 0 towards LCP, and the CSS animation then
runs without repainting — LCP moved from first paint (1.4s) to hydration
(2.4s) on a throttled phone until this was fixed.

**A card's shadow and border come from the band, not the card.**
`data-tone="card"` deliberately sets no `--tone-cast` / `--tone-rim`,
so a white card casts Sky Blue on paper and ink and Night on Sky Blue.
