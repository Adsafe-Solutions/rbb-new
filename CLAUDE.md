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

**`.reveal` is scanned once on mount** by `hooks/useReveal.js`. Anything
rendered later is never observed and would sit at `opacity: 0` forever. Give
async content its own CSS animation.

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

Read `design/DESIGN.md` before changing anything visual. The short version:
two blues and one green over three neutrals — Sky Blue for bands and
accents, Deep Trust Blue for headlines and nav, Growth Green for the one
filled button, Charcoal for body text — nothing has a sharp corner, one
shadow at 12%. Colour token NAMES are historical (`bumble-honey` is Sky
Blue, `bumble-ink` is Charcoal); read `theme.css` for the mapping.
Screenshots of the reference layout are in `design/reference/`.
