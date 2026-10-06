/* =========================================================
   The motion system's React lifecycle — mounted once, in App's Shell.

   It renders nothing. It is here, rather than in src/components/,
   because it is not a piece of the interface: it is the thing that
   starts smooth scrolling, scans each page for the motion attributes
   (animations/reveals.js), and — the part that actually matters —
   takes all of it apart again in the right order.

   ⚠ WHY gsap.matchMedia AND NOT AN EFFECT PER QUERY. matchMedia is a
   GSAP context that knows which media queries it was built under. When
   one of them changes it reverts everything it created — inline
   styles, ScrollTriggers, the lot — and re-runs the setup under the
   new answer. That is what makes two things work that are otherwise
   very fiddly: turning `prefers-reduced-motion` ON mid-session really
   does stop the page and hand scrolling back to the browser, and
   rotating a phone into landscape rebuilds every reveal with the
   desktop distances instead of leaving it with the ones it was first
   drawn with.

   ⚠ WHY THE SCAN IS A PASSIVE EFFECT AND NOT A LAYOUT EFFECT. Both
   would be flash-free — the elements are already hidden by CSS before
   the first paint, so there is nothing to flash. But a layout effect
   would run BEFORE App's ScrollToTop has moved the window, so on a
   route change out of the bottom of a long page every trigger on the
   new page would be created already scrolled past, fire at once, and
   the new page would arrive with all its animations spent. Passive
   effects run in tree order, this component is last in the Shell, and
   by the time it scans the window is where the new page starts.
========================================================= */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { gsap, ScrollTrigger } from "./gsap.js";
import { MEDIA } from "./config.js";
import { startSmoothScroll } from "./lenis.js";
import { bindMotion, hasUnbound } from "./reveals.js";

export default function MotionProvider() {
  const { pathname } = useLocation();

  /* Smooth scrolling, for the life of the app — not per page. Tearing
     Lenis down and building it again on every navigation would drop
     the scroll position mid-change and leave GSAP's ticker with a
     dead callback on it. */
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(MEDIA.motion, () => startSmoothScroll());
    return () => mm.revert();
  }, []);

  /* The page's own motion, rebuilt for each route. */
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add({ motion: MEDIA.motion, small: MEDIA.small }, (context) => {
      const { motion, small } = context.conditions;
      /* Reduced motion: nothing is bound, nothing moves, and the CSS
         in styles/index.css has already made every element that WOULD
         have animated plainly visible. Content never depends on this
         function having run. */
      if (!motion) return undefined;

      /* <main> and not <body>: the header and the footer are outside
         the router and persist across navigations, so re-scanning them
         on every route change would re-hide and re-reveal a footer the
         reader is already looking at. */
      const root = document.getElementById("main") ?? document.body;
      const release = [bindMotion(root, { small })];

      /* ⚠ Content that arrives LATER — a filtered list, a tab panel, a
         story that renders after its data — is not in the first scan.
         The old useReveal could not see it at all, and said so: its
         elements would have sat at opacity 0 forever. This watches for
         new nodes and binds only what is genuinely unclaimed, so the
         limitation is gone rather than documented.

         Two guards, because the observer is watching a subtree GSAP
         itself writes into (SplitText builds real line elements): the
         work is coalesced to one pass a frame, and a pass that finds
         nothing new does nothing at all — including no refresh, which
         is what would otherwise turn a re-split into a loop. */
      let frame = 0;
      const rescan = () => {
        frame = 0;
        if (!hasUnbound(root)) return;
        context.add(() => release.push(bindMotion(root, { small })));
        ScrollTrigger.refresh();
      };
      const observer = new MutationObserver(() => {
        if (!frame) frame = requestAnimationFrame(rescan);
      });
      observer.observe(root, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        /* Split markup out of the DOM and counters back to their
           rendered text BEFORE the context reverts the tweens — after
           it, the elements these close over may already be gone. */
        release.forEach((fn) => fn());
      };
    });

    return () => mm.revert();
  }, [pathname]);

  return null;
}
