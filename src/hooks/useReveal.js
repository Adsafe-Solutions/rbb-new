import { useEffect } from "react";

/* Fades `.reveal` elements in as they enter the viewport.

   One observer for the whole page rather than one per component: the
   callback is the same for every element and a single observer is what
   keeps the cost flat as sections are added.

   ⚠ Scans the DOM ONCE, on mount. An element rendered later — a list that
   arrives from an API, a panel that opens — is never observed and would sit
   at opacity 0 forever. Give async content its own CSS animation instead of
   a `.reveal` class.

   ⚠ `unobserve` after revealing: these are entrance animations, not
   scroll-linked ones. Without it an element re-hides every time it leaves
   the viewport and flickers on the way back up. */
export function useReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    /* No IntersectionObserver (or a reader who asked for reduced motion):
       show everything immediately. Hiding content behind an animation that
       will never run is the one failure mode worth ruling out. */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      /* Fires a little before the element is fully on screen, so the
         transition finishes about when it reaches a comfortable reading
         position rather than starting there. */
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default useReveal;
