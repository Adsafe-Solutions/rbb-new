# RBB

React + Vite front end, built on a token-driven design system.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
```

Visit **`/design-system`** in dev for the living token reference — every
swatch on that page is rendered from a real utility, so it cannot drift from
the code.

## Where things are

```
design/
  DESIGN.md        the written style reference
  tokens.json      the DTCG token export theme.css is generated from
  reference/       the screenshots the layout was built against
src/
  styles/
    theme.css      ← THE design system. Tailwind reads this.
    variables.css  the same tokens as plain custom properties
    index.css      base layer: document styles, Lenis, reveal states
  animations/      the motion system: Lenis, GSAP, the attribute scanner
  content/         every string on the site
  components/      one folder per component
  pages/           one folder per route
  config/          env reading and feature switches
```

## The rules that matter

**No hex codes in `src/` outside `styles/`.** Every colour is named in
`theme.css`, and Tailwind emits a utility for each one — `--color-pollen`
becomes `bg-pollen`, `text-pollen`, `border-pollen`. A component that wants a
colour reaches for the utility, never the literal.

**Tailwind v4, so there is no `tailwind.config.js`.** The theme lives in CSS.
Adding a token to the `@theme` block in `theme.css` is all it takes for the
utility to exist.

**Write class names out in full.** Tailwind finds classes by scanning source
files for literal strings; it does not evaluate JavaScript. `` `bg-${token}` ``
generates nothing and renders transparent. Keep a lookup map of complete class
strings instead — `components/Button` and `pages/DesignSystem` both do.

**Pair the type utilities.** Each size ships with its own leading and tracking:
`text-body leading-body tracking-body`. The positive tracking at every size is
what gives the face its open cadence — never zero it out.

**One filled button, and it is ink.** Yellow is the brand's warmth, not its
clickability. A honey button carries no affordance and competes with the real
call to action. See the Do's and Don'ts in `design/DESIGN.md`.

## Content and assets

All copy is in `src/content/`. The brand name comes from `content/brand.js` —
including the oversized hero mark, which renders whatever string it is given.

Photography is not wired up yet. Content entries name a `photo` label and
`components/Photo` draws a tonal placeholder at the correct aspect ratio, so
every section holds its true shape. To drop in real art, import the file and
swap `photo: "portrait-seafront"` for `src: portraitSeafront`. Nothing else
changes.

The QR code in `components/GetApp` is a placeholder pattern at the right
density. **It does not scan** — replace it before this goes anywhere public.

## Environment

Copy `.env.example` to `.env.local`. Only `VITE_*` keys reach the browser;
nothing in the file is secret today. Feature switches default from
`src/config/sections.js`, so an environment only names what it wants different.
