/* =========================================================
   Smooth scrolling — Lenis, and the one scroll position the rest of
   the site is allowed to set.

   HOW IT WORKS. Lenis does not replace the page's scroll with a
   transform: it intercepts the wheel, and moves the REAL window
   scroll position toward where the wheel asked to be, a little each
   frame. Everything that reads `window.scrollY` or
   `getBoundingClientRect()` — the header's hero observer, the project
   timeline, ScrollTrigger, the browser's own scroll restoration, an
   anchor jump, sticky positioning — keeps working, because there is
   nothing to keep in step with: the page really is scrolled to where
   it appears to be.

   ONE FRAME LOOP. GSAP's ticker drives Lenis, and Lenis tells
   ScrollTrigger when the position changed. A second
   requestAnimationFrame loop would mean two clocks a frame apart, and
   a scrubbed animation lagging its own scroll by one frame is exactly
   the jitter smooth scrolling is supposed to remove. Hence
   `autoRaf: false` — Lenis's own loop stays off.

   ⚠ Touch is NOT intercepted (config.SMOOTH.syncTouch). See the note
   there: a phone already scrolls better than JavaScript can.

   ⚠ The CSS half of this lives in styles/index.css under `html.lenis`
   — Lenis sets those classes itself, and without the rules the page
   fights its own `scroll-behavior: smooth`.
========================================================= */
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap.js";
import { SMOOTH } from "./config.js";

/* The single instance, or null when smooth scrolling is off — which
   is the case before the app mounts, under `prefers-reduced-motion`,
   and on the server. Every helper below falls back to the native
   behaviour in that state, so nothing here is ever load-bearing. */
let lenis = null;
let tick = null;

/* Starts smooth scrolling and returns the teardown. Called once, from
   MotionProvider, inside the reduced-motion condition — so asking for
   reduced motion mid-session really does hand the page back to the
   browser, rather than only stopping the reveals. */
export function startSmoothScroll() {
  if (lenis || typeof window === "undefined") return () => {};

  lenis = new Lenis({
    duration: SMOOTH.duration,
    easing: SMOOTH.easing,
    smoothWheel: true,
    syncTouch: SMOOTH.syncTouch,
    /* We drive the frames (see above). */
    autoRaf: false,
    /* Anchor clicks stay the router's job: App.jsx already aligns the
       page on `#section`, allowing for the fixed header, and two
       things animating the scroll toward the same element end with
       one of them winning halfway. */
    anchors: false,
  });

  /* Lenis moved the page → ScrollTrigger re-evaluates. Nothing else
     needs telling: everyone else is reading the real scroll position
     and gets the real `scroll` event. */
  lenis.on("scroll", ScrollTrigger.update);

  /* GSAP's ticker is in seconds, Lenis wants milliseconds. */
  tick = (time) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);

  /* ⚠ OFF. Lag smoothing is GSAP's defence against a long main-thread
     stall: it pretends no time passed, so animations do not jump. For
     a scroll-linked page that is the wrong trade — the page would
     arrive at a scroll position its animations think is somewhere
     else. Better a dropped frame than a desynchronised one. */
  gsap.ticker.lagSmoothing(0);

  return () => {
    if (tick) gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
    tick = null;
    /* Back to the browser's own smoothing, and to whatever the
       document's `scroll-behavior` says. */
    gsap.ticker.lagSmoothing(500, 33);
  };
}

/* The live instance, for the few places that need to ask. */
export const smoothScroll = () => lenis;

/* ---------------- The scroll helpers ----------------

   Everything in the app that moves the window scrolls THROUGH these,
   never through `window.scrollTo` directly.

   Not because the native call breaks — it does not, Lenis scrolls the
   real window — but because a native jump lands the page somewhere
   Lenis is still animating TOWARD, and it will carry on and undo it.
   Handing Lenis the destination instead cancels whatever it was doing.
   With Lenis off, each one is the native call it replaces. */

/* An instant jump: a route change, or lining a section up under the
   header. Never animated — a page change should be a cut. */
export function jumpTo(target, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { immediate: true, offset, force: true });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target + offset, behavior: "instant" });
    return;
  }
  target?.scrollIntoView({ behavior: "instant", block: "start" });
  if (offset) window.scrollBy({ top: offset, behavior: "instant" });
}

/* A deliberate, visible glide — the footer's "back to top". With
   Lenis off this is the document's own `scroll-behavior: smooth`,
   which the reduced-motion rule in styles/index.css already turns
   off, so there is nothing extra to keep in step. */
export function glideTo(target, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset, force: true });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target + offset });
    return;
  }
  target?.scrollIntoView({ block: "start" });
}

/* Freezes and releases the page behind an overlay — the mobile menu.

   ⚠ Setting `overflow: hidden` on <html> is not enough on its own:
   Lenis is listening to the wheel, not to the scrollbar, and would go
   on moving a page that cannot show it. Header.jsx pairs the two. */
export function pauseScroll() {
  lenis?.stop();
}

export function resumeScroll() {
  lenis?.start();
}
