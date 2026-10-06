/* =========================================================
   The motion vocabulary — every duration, curve, distance and
   threshold the site animates with, in one place.

   Read this file the way you read styles/theme.css: nothing below
   invents a value of its own, and a component never passes a raw
   number to GSAP. If a reveal feels wrong everywhere at once, it is
   one number here, not forty call sites.

   ⚠ The CSS half of the same vocabulary is `--motion-*` in
   styles/variables.css, for the hover and focus transitions that are
   plain CSS. When a value changes, change it in both — same rule as
   theme.css / variables.css.

   ⚠ The motion tokens are deliberately NOT in theme.css. Tailwind v4
   owns the `--ease-*` and `--duration-*` namespaces: `--ease-out:` in
   an @theme block silently redefines the `ease-out` UTILITY for the
   whole app, exactly the way `--spacing-8` redefines `p-8` (see the
   warning in theme.css). `--motion-` collides with nothing.
========================================================= */

/* ---------------- Time ----------------
   The bands from the motion brief. A reveal is not a hover and a
   photograph is not a line of text: each kind of movement has a
   length that makes it read as deliberate rather than as lag. */
export const DURATION = {
  /* A control acknowledging a pointer — colour, a 1px lift. */
  micro: 0.2,
  /* A card answering a hover. */
  hover: 0.35,
  /* The default: a block of content arriving as you scroll to it. */
  reveal: 0.7,
  /* A photograph, which is a bigger object and settles more slowly. */
  image: 0.9,
  /* A headline's lines, each one. */
  headline: 0.8,
  /* A whole band choreographing itself. */
  band: 1.1,
  /* A number counting to its value. Long enough to read as counting,
     short enough that nobody waits for it. */
  count: 1.6,
};

/* ---------------- Curves ----------------
   One family. `out` is the site's curve — the same shape the CSS
   `.reveal`/`.enter` transitions have always used
   (cubic-bezier(0.22, 1, 0.36, 1)); GSAP's power3.out is that curve to
   within a pixel of travel, and costs no extra plugin to express.

   `none` is for anything scrubbed against the scroll wheel: easing a
   scrubbed animation makes the page feel like it is fighting the
   reader's hand. */
export const EASE = {
  out: "power3.out",
  soft: "power2.out",
  none: "none",
};

/* ---------------- Distance ----------------
   How far things travel, in px. Small on purpose: the movement is
   there to give the eye a direction, not to make an entrance. Anything
   over ~40px starts reading as a slide. */
export const DISTANCE = {
  /* Supporting copy, captions, a CTA under a heading. */
  sm: 14,
  /* The default for a block of content. */
  md: 26,
  /* A whole section's lead element. */
  lg: 36,
};

/* On a phone every reveal is happening in a third of the space, so the
   same 26px reads as a lurch. Everything travels this much of its
   desktop distance below `md`. */
export const MOBILE_TRAVEL = 0.55;

/* ---------------- Stagger ---------------- */
export const STAGGER = {
  /* Lines of one headline — tight enough to read as one object. */
  lines: 0.085,
  /* Sibling cards in a grid or row. The brief's 80–120ms. */
  cards: 0.09,
  /* The steps of one choreographed band: image, eyebrow, heading,
     paragraph, CTA. Slower, because each step is a different thing. */
  sequence: 0.11,
};

/* ---------------- Scroll ----------------
   Where a reveal fires. "top 85%" is the element's top crossing 85% of
   the way down the viewport — a little before it is comfortably in
   view, so the movement finishes about where the eye arrives rather
   than starting there. The same intent as useReveal's old
   `rootMargin: 0px 0px -10%`. */
export const START = "top 85%";

/* A reveal is an ENTRANCE, not a scroll-linked effect: once played it
   stays played. Without this an element re-hides every time it leaves
   the viewport and flickers on the way back up. */
export const ONCE = true;

/* ---------------- Parallax ----------------
   Percent of its own height a parallax image travels across the whole
   time it is on screen — so ±3% for the default, which is a few pixels
   a second at reading speed. Anything larger and the photograph starts
   to look detached from the page.

   ⚠ An element that moves inside a fixed box has to be bigger than the
   box or it exposes an edge. animations/parallax.js derives that
   overscale from the travel; do not set a scale by hand. */
export const PARALLAX = {
  default: 6,
  max: 10,
};

/* ---------------- Smooth scroll ----------------
   Lenis. `duration` is how long it takes to catch up to where the
   wheel has asked to be — 1.05s is the point where the page feels
   weighted rather than either sticky or loose.

   `syncTouch` stays OFF: a phone's own scrolling is already
   momentum-based and hardware-accelerated, and overriding it with
   JavaScript is both worse to use and the single biggest way a smooth
   scroll library hurts a mobile device. Touch scrolls natively; Lenis
   still reports the position so ScrollTrigger stays in step. */
export const SMOOTH = {
  duration: 1.05,
  /* Exponential ease-out — the standard Lenis curve. */
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  syncTouch: false,
};

/* How long the headline's marker rests on each word before moving to
   the next. Long enough to read the word and notice the sentence
   around it; short enough that a visitor who stays a few seconds sees
   the whole line get its turn. */
export const MARK_SECONDS = 3;

/* ---------------- Media queries ----------------
   The conditions the whole system is built on. gsap.matchMedia() takes
   these and re-runs (and cleans up after) every animation when one of
   them changes — which is what makes turning reduced motion on or off
   mid-session work without a reload. */
export const MEDIA = {
  /* The one that matters most. Everything motion-related is inside
     this condition; nothing outside it moves. */
  motion: "(prefers-reduced-motion: no-preference)",
  /* Below `md`. Mobile is not desktop scaled down: shorter travel, no
     parallax, no pinned choreography. */
  small: "(max-width: 47.999rem)",
};

/* A plain, synchronous answer for the few places that cannot wait for
   a matchMedia context — the smooth-scroll lifecycle, mostly. Always
   false on the server, where there is no window and nothing moves. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
