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

Much of that content is a WORKING PLACEHOLDER while RBB's own words are
written. Every placeholder says so on its face — "Demo text — …",
"· Demo profile", "(demo)", reserved `example.org` / `555 01xx` contact
values — so nothing invented can be read as RBB's. Write new placeholders
the same way; see `docs/WORKING_CONTENT.md`. A few things never get a
placeholder, because a self-label cannot save them: impact figures,
financial percentages and any DOCUMENT (a report link is a file someone
downloads). Those stay empty or `pending-review` until RBB supplies them.

What the build enforces splits in two (`scripts/production-gate.mjs`):

- **Safety** — credentials, forbidden files, dev-catalogue routes. Always
  fails the build. Also `src/content/validate.js`, on the content files.
- **Readiness** — where working placeholders are still published. Never
  fails a build; it is written to `build-meta/content-readiness.json` and
  blocks PRODUCTION-CONTENT-READY in `npm run release:status` (approvals
  in `release/approvals.mjs`, docs/RELEASE_READINESS.md).

Environments still differ in INFRASTRUCTURE: email (off/test/live),
payments (off/test/live), analytics, secrets and indexing. Deploy/launch:
`docs/LAUNCH_RUNBOOK.md` — `npm run smoke`, `npm run release:package`.
Host adapters use only `createServerApp` (`server/app.mjs`); no host is
chosen yet — `docs/HOST_CONFIGURATION.md`.

## Conventions

- One folder per component, one per page: `components/Button/Button.jsx`.
- Copy lives in `src/content/`, never inline in a component.
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
