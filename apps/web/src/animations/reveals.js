/* =========================================================
   The scanner — the one piece of code that turns markup into motion.

   THE IDEA. A component does not import GSAP, does not write a tween
   and does not own a ScrollTrigger. It says what a piece of content
   IS, in an attribute, and this file decides how that behaves. One
   place to tune the whole site's rhythm, one place where cleanup
   happens, and a component diff that is one attribute long.

   It is the same bargain the old `.reveal` class made — one observer
   for the page rather than one per component — kept, and extended.
   `.reveal` still means exactly what it always did, on all seventy-odd
   elements that carry it.

   ---------------- The vocabulary ----------------

     .reveal                  the default: fade up as it arrives.
     data-anim="fade-up"      the same, written out.
     data-anim="fade"         opacity only — for something already in
                              position, or a full-bleed band.
     data-anim="lead"         a section's lead element; travels further.
     data-anim="image"        a photograph: from 1.06 and transparent.
                              ⚠ Goes on the <img>, inside a clipping
                              parent — on the frame instead it scales
                              the card and its shadow, which reads as
                              the card zooming. ⚠ Never together with
                              `data-parallax` on one element: both
                              drive `scale`, and the second one wins.
     data-anim="sequence"     a band that choreographs itself. Its
                              descendants marked `data-anim-item`
                              arrive in DOM order, one after another.

   ⚠ THERE IS NO `hero` HERE, on purpose. A page's opening screen is
   animated by CSS instead (`data-enter-*` in styles/index.css), because
   this scanner does not run until React has hydrated — about 1.9
   seconds after first paint on a throttled phone — and the largest
   thing on the first screen cannot wait that long to exist. Measured:
   as a sequence here, the homepage hero's own paragraph became the
   Largest Contentful Paint at 2.3s; in CSS it is 1.3s. Above the fold
   is CSS's; everything you scroll to is this file's.
     data-anim-item           a step of a sequence. Takes its own
                              `data-anim` preset, or fades up.
     data-anim-order="-1"     move a step earlier or later in its
                              sequence. Steps run in DOM order by
                              default, which is usually the reading
                              order — but a split layout puts the
                              photograph AFTER the copy in the markup,
                              so that the heading outline reads
                              properly, while the eye meets the picture
                              first. Sorted ascending, ties keep their
                              DOM order, default 0.
     data-anim-stagger        a row or grid of SIBLING cards: the
                              direct children arrive in turn. Takes a
                              preset as its value.
     data-split="lines"       reveal this element's text line by line,
                              out of a clipping mask (animations/text).
     data-parallax="6"        drift against the page as it passes
                              (animations/parallax). Large images only.
     data-mark-cycle="3"      move the highlight across this heading's
                              `[data-mark]` words, this many seconds
                              each (animations/marks).
     data-count               count up to the figure already rendered
                              here (animations/counters). Opt-in per
                              figure, on editorial grounds — read the
                              warning in that file before adding one.

   ---------------- Rules ----------------

   ⚠ Everything this file hides is hidden by CSS FIRST (the
   `.js [data-anim]` rules in styles/index.css), before a frame is
   painted. Hiding from JavaScript means the pre-rendered HTML paints,
   THEN disappears, then comes back — which is worse than no animation
   at all. The corollary: an element that is given an attribute here
   and never scanned would stay invisible, so the scan has to be the
   thing that cannot fail — hence the re-scan on new content below,
   and the reduced-motion override in CSS rather than in JS.

   ⚠ Nothing in here is required to read the page. Without JavaScript
   no attribute does anything (the CSS is behind `.js`), and under
   `prefers-reduced-motion` the whole scanner never runs — the content
   is simply there.
========================================================= */
import { gsap } from "./gsap.js";
import {
  DISTANCE,
  DURATION,
  EASE,
  MOBILE_TRAVEL,
  ONCE,
  PARALLAX,
  STAGGER,
  START,
} from "./config.js";
import { revealLines } from "./text.js";
import { bindParallax } from "./parallax.js";
import { bindTimeline } from "./timeline.js";
import { bindCounter } from "./counters.js";
import { bindMarkCycle } from "./marks.js";

/* Every element the scanner can act on, and — separately — the three
   that own OTHER elements' motion. An element inside one of those is
   the group's business, never the scanner's, or it would animate
   twice against two different clocks. */
const GROUPS = '[data-anim="sequence"], [data-anim-stagger]';
const REVEALS = ".reveal, [data-anim], [data-anim-stagger], [data-split]";
const MODIFIERS = "[data-parallax], [data-count], [data-mark-cycle], [data-timeline]";

/* Set on everything already bound, so a re-scan after new content
   arrives picks up only what is new. Two flags, because the two kinds
   of attribute are independent: a photograph can perfectly well fade
   in AND drift, and one of those being handled must not stop the
   other. Both are removed on teardown — a stale flag on an element
   React kept across a route change would mean it never animates
   again. */
const CLAIMED = "motionBound";
const MODIFIED = "motionExtra";

const isClaimed = (el) => CLAIMED in el.dataset;
const ownedByGroup = (el) => Boolean(el.parentElement?.closest(GROUPS));

/* Is there anything in `root` the scanner has not already dealt with?
   The cheap question MotionProvider asks on every DOM change, so that
   a page that has simply re-rendered costs one `querySelector` and
   not a full rebind. */
export const hasUnbound = (root) =>
  Boolean(
    root.querySelector(
      `:is(${REVEALS}):not([data-motion-bound]), :is(${MODIFIERS}):not([data-motion-extra])`
    )
  );

/* Mobile travels less far — see MOBILE_TRAVEL. */
const travel = (px, small) => Math.round(px * (small ? MOBILE_TRAVEL : 1));

/* A preset name → the two states of the tween. `undefined` and any
   unknown name fall through to the default, so a typo in an attribute
   is a plain fade-up rather than an element that never appears. */
function states(name, small) {
  switch (name) {
    case "fade":
      return [{ opacity: 0 }, { opacity: 1, duration: DURATION.reveal }];
    case "soft":
      return [
        { opacity: 0, y: travel(DISTANCE.sm, small) },
        { opacity: 1, y: 0, duration: DURATION.reveal },
      ];
    case "lead":
      return [
        { opacity: 0, y: travel(DISTANCE.lg, small) },
        { opacity: 1, y: 0, duration: DURATION.reveal },
      ];
    case "image":
      /* Down to its true size rather than up from small: a photograph
         settling into place, which is the one image move that does not
         read as a zoom. 1.06 is the most that stays imperceptible as a
         change of crop. */
      return [
        { opacity: 0, scale: 1.06 },
        { opacity: 1, scale: 1, duration: DURATION.image },
      ];
    default:
      return [
        { opacity: 0, y: travel(DISTANCE.md, small) },
        { opacity: 1, y: 0, duration: DURATION.reveal },
      ];
  }
}

/* The finished tween leaves the element with an inline opacity of 1 —
   which is what beats the CSS rule that hid it — and no transform at
   all. Leaving a `translate(0,0)` behind on every revealed element
   would give each one a stacking context and a containing block it did
   not have before, which is how a `position: fixed` child or a sticky
   heading quietly stops working three sections later. */
const SETTLED = { ease: EASE.out, clearProps: "transform" };

function reveal(el, name, small, extra = {}) {
  const [from, to] = states(name, small);
  gsap.fromTo(el, from, { ...to, ...SETTLED, ...extra });
}

/* ---------------- The scan ----------------

   Binds everything in `root` that is not bound already, and returns
   the teardown for the things GSAP cannot revert on its own (split
   markup, a counter's text, the claim flags).

   `small` comes from the caller's matchMedia condition, not from a
   width read here: the caller re-runs the whole scan when it changes,
   so a phone rotated to landscape gets the desktop distances rather
   than the ones it was first drawn with. */
export function bindMotion(root, { small }) {
  const claimed = [];
  const teardown = [];

  const claim = (el) => {
    el.dataset[CLAIMED] = "";
    claimed.push(el);
  };

  /* Pass 0 — the modifiers. Deliberately blind to groups: a hero
     photograph drifts whether or not the copy beside it is a
     sequence, and neither of them owns the other. */
  for (const el of root.querySelectorAll(MODIFIERS)) {
    if (MODIFIED in el.dataset) continue;
    el.dataset[MODIFIED] = "";
    claimed.push(el);

    /* No parallax on a phone: see the note in animations/parallax.js. */
    if ("parallax" in el.dataset && !small) {
      bindParallax(el, Number(el.dataset.parallax) || PARALLAX.default);
    }
    /* The pinned sideways timeline, on every screen with motion
       (animations/timeline.js); with reduced motion it stays a native
       swipeable strip. */
    if ("timeline" in el.dataset) {
      const release = bindTimeline(el, { small });
      if (release) teardown.push(release);
    }
    if ("count" in el.dataset) {
      const restore = bindCounter(el);
      if (restore) teardown.push(restore);
    }
    if ("markCycle" in el.dataset) {
      const restore = bindMarkCycle(el);
      if (restore) teardown.push(restore);
    }
  }

  const elements = Array.from(root.querySelectorAll(REVEALS)).filter(
    (el) => !isClaimed(el)
  );

  /* Pass 1 — the groups, which claim their own members. A group
     inside another group is still bound on its own (its items are
     excluded from the outer one's list below): the nesting is
     probably a mistake, but content that never appears is a worse
     answer to it than two overlapping rhythms. */
  for (const el of elements) {
    if (!el.matches(GROUPS)) continue;
    claim(el);

    /* A row of equal siblings: the direct children, in turn. */
    if ("animStagger" in el.dataset) {
      const items = Array.from(el.children);
      if (!items.length) continue;
      items.forEach(claim);
      const [from, to] = states(el.dataset.animStagger, small);
      gsap.fromTo(items, from, {
        ...to,
        ...SETTLED,
        stagger: STAGGER.cards,
        scrollTrigger: { trigger: el, start: START, once: ONCE },
      });
      continue;
    }

    /* A choreographed band: image, then eyebrow, then heading, then
       paragraph, then the way on. Each step keeps its own preset. */
    const items = Array.from(el.querySelectorAll("[data-anim-item]"))
      .filter((item) => item.closest(GROUPS) === el)
      /* Stable, so anything that does not ask for an order keeps the
         one the markup gave it. */
      .sort(
        (a, b) => Number(a.dataset.animOrder ?? 0) - Number(b.dataset.animOrder ?? 0)
      );
    if (!items.length) continue;

    items.forEach((item, i) => {
      claim(item);
      const delay = i * STAGGER.sequence;

      if (item.dataset.split === "lines") {
        const split = revealLines(item, { trigger: el, delay });
        teardown.push(() => split.revert());
        return;
      }
      reveal(item, item.dataset.anim, small, {
        delay,
        scrollTrigger: { trigger: el, start: START, once: ONCE },
      });
    });
  }

  /* Pass 2 — everything standing on its own. Anything inside a group
     is that group's business and was claimed above. */
  for (const el of elements) {
    if (isClaimed(el) || ownedByGroup(el)) continue;
    claim(el);

    if (el.dataset.split === "lines") {
      const split = revealLines(el, { trigger: el });
      teardown.push(() => split.revert());
      continue;
    }

    /* `.reveal` with no `data-anim` is the default preset — which is
       what the class has always meant. */
    reveal(el, el.dataset.anim, small, {
      scrollTrigger: { trigger: el, start: START, once: ONCE },
    });
  }

  return () => {
    teardown.forEach((fn) => fn());
    claimed.forEach((el) => {
      delete el.dataset[CLAIMED];
      delete el.dataset[MODIFIED];
    });
  };
}
