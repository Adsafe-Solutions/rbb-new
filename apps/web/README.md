# RBB website (`@rbb/web`)

The public Rising Beyond Borders website: React 18 + Vite + Tailwind v4,
pre-rendered to static HTML, deployed to Cloudflare Pages. Its content is
published from the Admin (CMS) through the API's snapshot.

## Run it

From the repository root (pnpm workspace — never `npm install` here):

```sh
pnpm install
pnpm web:dev        # http://localhost:5173 — the saved copy of the live content
pnpm web:build      # dist/ — with RBB_SNAPSHOT_URL unset, from the saved copy
pnpm web:test       # unit and render tests
pnpm web:validate   # content checks
```

`/design-system` and `/components` render the design system live in dev.

## Where things are

```
src/
  styles/        theme.css (THE design system), variables.css, index.css
  animations/    the motion system: Lenis, GSAP, the attribute scanner
  content/       page wording, navigation, footer, forms — and the empty
                 exports the CMS snapshot fills
  components/    one folder per component
  pages/         one folder per route
  config/        env reading and feature switches
  contract/      build-time checks against the content contract
scripts/         the build: snapshot fetch and adapter, prerender, deploy
fixtures/        published-snapshot.json — the saved copy of the live CMS data
docs/            deployment, security, forms, donations, release readiness
```

## Content

Everything the CMS publishes — homepage, About, Impact, team, programs,
projects, stories, news, events, appeals, policies, Get Involved,
contact and brand — comes from the API's published snapshot. The website
keeps no built-in copy of it (see `docs/PUBLISHING.md` at the repository
root, "No built-in content"). Production builds fetch the live snapshot;
local builds, tests and the dev server use `fixtures/published-snapshot.json`.
Refresh that file from `https://api.risingbeyondborders.org/api/v1/public/snapshot`
when the live content changes.

What stays in `src/content/` is what the CMS does not manage: navigation,
footer columns, page frames and interface wording, photographs, SEO
structure, the built-in forms, Our Approach and Where We Work.

## Rules

The working rules for this app — design system, motion, snapshot
mappings and their gotchas — are in `CLAUDE.md`. In short: no hex codes
outside `src/styles/`; write Tailwind class names out in full (no
interpolation); keep content exports as `export const NAME = …` objects or
arrays, because the build assigns the snapshot into them.

## Environment

Copy `.env.example` to `.env.local`. Only `VITE_*` keys reach the browser.
Feature switches default from `src/config/sections.js`. Deploying:
`docs/DEPLOY_CLOUDFLARE_PAGES.md`.
