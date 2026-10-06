/* =========================================================
   Parallax — a photograph drifting a little against the page.

   Scrubbed, not timed: the image's position is a function of where the
   page is, so the reader's wheel is the only clock. A parallax with a
   duration of its own is a photograph that keeps moving after you have
   stopped scrolling, which reads as a bug.

   ⚠ THE OVERSCALE IS NOT DECORATION. An element that moves inside a
   fixed frame has to be larger than the frame, or it pulls its own
   edge into view and shows the background through the gap. The scale
   below is derived from the travel — never set one by hand, and never
   raise the travel without it.

   Restraint is the whole brief here: ±3% of the element's height
   across a full screen of scrolling is a few pixels a second. Large
   photographs only (hero, a band's editorial image), never a card in a
   grid — twelve cards each drifting at their own rate is a page that
   will not sit still.

   Not on phones: see animations/reveals.js, which does not call this
   under the `small` condition. The effect needs a tall viewport to
   register at all, and the movement costs the most where the device
   can afford it least.
========================================================= */
import { gsap } from "./gsap.js";
import { EASE, PARALLAX } from "./config.js";

/* The box the image moves INSIDE, which is what the scroll is measured
   against — never the image itself, whose position this is about to
   start changing.

   ⚠ Skips `display: contents` ancestors. components/Picture wraps
   every photograph on the site in `<picture class="contents">`, and a
   `contents` element generates no box at all: its
   getBoundingClientRect() is 0×0 at 0,0, so a trigger on it would put
   the whole effect at the top of the document. */
const frameOf = (el) => {
  let node = el.parentElement;
  while (node && getComputedStyle(node).display === "contents") node = node.parentElement;
  return node ?? el;
};

/* Drifts `el` by `amount` percent of its own height across the whole
   time it is on screen. */
export function bindParallax(el, amount = PARALLAX.default) {
  const travel = Math.min(Math.max(amount, 0), PARALLAX.max);
  if (!travel) return;

  /* Half the travel each way from centre, so the image sits where the
     layout put it when it is level with the middle of the viewport —
     the position it was composed at. The +1% is slack for subpixel
     rounding at the edges. */
  gsap.set(el, { scale: 1 + travel / 100 + 0.01, transformOrigin: "50% 50%" });

  gsap.fromTo(
    el,
    { yPercent: -travel / 2 },
    {
      yPercent: travel / 2,
      ease: EASE.none,
      scrollTrigger: {
        trigger: frameOf(el),
        /* The element's whole pass across the viewport, bottom edge to
           top edge — the longest possible run, which is what keeps the
           rate low. */
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        /* Percentages are resolved against a measured height; a
           breakpoint change or a font reflow makes the old one wrong. */
        invalidateOnRefresh: true,
      },
    }
  );
}
