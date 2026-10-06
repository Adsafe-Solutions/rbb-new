/* =========================================================
   The one place GSAP is set up.

   Every other file in src/ imports gsap FROM HERE, never from the
   package. Registering a plugin twice is harmless; registering it in
   twelve files means the thirteenth forgets, and the failure is a
   silent no-op at runtime rather than an error at build time.

   ⚠ This module is reached during the BUILD's server render
   (entry-server.jsx → App.jsx → MotionProvider), where there is no
   window. GSAP and its plugins import cleanly under Node, but anything
   that touches the document has to stay behind the guard below.
========================================================= */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DURATION, EASE } from "./config.js";

/* SplitText is no longer a paid plugin — it ships in the gsap package
   from 3.13 — so there is no bundle of club plugins to install and no
   licence file to keep anywhere. */
gsap.registerPlugin(ScrollTrigger, SplitText);

if (typeof window !== "undefined") {
  /* The site's curve and length, so a tween that says nothing about
     either still belongs to the same system. */
  gsap.defaults({ ease: EASE.out, duration: DURATION.reveal });

  /* ⚠ A phone fires `resize` every time the URL bar collapses or
     expands DURING a scroll, and a ScrollTrigger refresh mid-scroll
     makes every pinned or scrubbed thing on the page jump. This tells
     ScrollTrigger to ignore a resize that is only the viewport height
     changing on a touch device — the same trap Header.jsx works around
     by hand for its own observer. */
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Web fonts land after the first ScrollTrigger positions are
     measured and reflow everything below them, which leaves every
     trigger on the page a line or two out. One refresh when the fonts
     are in puts them all back. */
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

export { gsap, ScrollTrigger, SplitText };
