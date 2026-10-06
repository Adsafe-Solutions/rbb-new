/* =========================================================
   The travelling highlight — the marker moving from one word of a
   headline to the next.

   A highlighter pen going back over a sentence and picking out a
   different word each time. It says the whole line matters rather
   than only its ending, and it is the one thing in the hero that
   keeps moving after the page has arrived.

   ⚠ IT MOVES A BACKGROUND, AND NOTHING ELSE. No text changes, no
   element is added or removed, no box is measured or resized. That is
   what makes it safe here: the words are all painted, in their final
   positions, from the first frame — a screen reader reads one
   unchanging sentence, the layout cannot shift, and the page's
   Largest Contentful Paint never waits for any of it. A marker that
   physically slid between words would need each word measured, and
   would be a layout read on a headline that is still settling.

   ⚠ It is also the only LOOP on the site. A loop earns its place when
   what it says stays true, and "every one of these words is the
   point" stays true for as long as the headline is on screen. It
   never runs under `prefers-reduced-motion`: the scanner does not
   bind it, the marker stays on the word the HTML shipped with, and
   that state is a complete design on its own.
========================================================= */
import { gsap } from "./gsap.js";
import { MARK_SECONDS } from "./config.js";

/* Cycles the `data-marked` attribute over `el`'s `[data-mark]` words,
   one every `data-mark-cycle` seconds. Returns a teardown that puts
   the marker back on the word the server rendered it on, or null when
   there is nothing to cycle.

   The CSS does the actual crossfade (`[data-mark]` in
   styles/index.css); this only ever says which word is current. */
export function bindMarkCycle(el) {
  const words = Array.from(el.querySelectorAll("[data-mark]"));
  /* One word is a static highlight, which is a perfectly good design
     and what a shorter headline gets. Nothing to move it to. */
  if (words.length < 2) return null;

  const seconds = Number(el.dataset.markCycle) || MARK_SECONDS;
  const initial = words.findIndex((w) => "marked" in w.dataset);
  const from = initial < 0 ? 0 : initial;

  const show = (n) =>
    words.forEach((word, i) => {
      if (i === n) word.dataset.marked = "";
      else delete word.dataset.marked;
    });

  /* A timeline rather than setInterval: it is created inside the
     scanner's matchMedia context, so it is paused, reverted and
     rebuilt with everything else — including the moment a reader
     turns reduced motion on. GSAP's ticker also stops with the tab,
     where an interval would go on firing in the background. */
  const timeline = gsap.timeline({ repeat: -1 });
  words.forEach((_, i) => {
    /* Start on the word the HTML already marked, so the first move is
       to the NEXT one and the page never flickers back to the start. */
    timeline.call(show, [(from + i + 1) % words.length], i * seconds);
  });
  /* Gives the timeline its full length; the calls above sit inside it. */
  timeline.to({}, { duration: words.length * seconds }, 0);

  return () => {
    timeline.kill();
    show(from);
  };
}
