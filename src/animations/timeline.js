/* =========================================================
   Timeline — a row of events that travels sideways as the page scrolls.

   Markup (components/ProgressTimeline):
     [data-timeline]            the section — the trigger
       [data-timeline-pin]      what is pinned (NOT the section: a pin
                                wraps its element in a spacer <div>, and
                                React must still find each section where
                                it put it when the page unmounts)
         [data-timeline-viewport]   the window onto the row
           [data-timeline-track]    the row itself, wider than the window
             [data-timeline-item]   one event each

   While the section is pinned, scrolling DOWN moves the row LEFT by
   exactly its overflow — scrubbed, so the wheel is the only clock (see
   parallax.js). The event nearest the progress is announced to the
   component as a `timeline:active` event; the component owns how the
   active card and the timeline rail look.

   Desktop only, and only with motion: on a phone, with reduced motion,
   or before this runs, the row is a native sideways-scrolling strip
   with snap points (the component's CSS), and the component highlights
   the centred card from the strip's own scroll.

   Keyboard: in the pinned row an off-screen card cannot scroll itself
   into view (the row moves by transform), so focusing anything in a
   card jumps the page to the scroll position that brings that card to
   its place on the timeline.
========================================================= */
import { gsap } from "./gsap.js";
import { EASE } from "./config.js";
import { jumpTo } from "./lenis.js";

export function bindTimeline(section) {
  const pin = section.querySelector("[data-timeline-pin]");
  const viewport = section.querySelector("[data-timeline-viewport]");
  const track = section.querySelector("[data-timeline-track]");
  const items = Array.from(section.querySelectorAll("[data-timeline-item]"));
  if (!pin || !viewport || !track || items.length < 2) return null;

  /* The component's CSS turns the native strip off from here on. */
  section.dataset.timelinePinned = "";
  viewport.scrollLeft = 0;

  const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  const last = items.length - 1;
  let active = -1;

  const tween = gsap.to(track, {
    x: () => -distance(),
    ease: EASE.none,
    scrollTrigger: {
      trigger: pin,
      /* Pinned at the top when the block fits the window; when it does
         not (a short laptop screen), pinned by its BOTTOM edge, so the
         cards and the timeline stay whole and only the heading has
         scrolled away. */
      start: () => (pin.offsetHeight > window.innerHeight ? "bottom bottom" : "top top"),
      /* 1.5 screens of wheel per screen of travel: the row moves at two
         thirds of the reader's scroll, so each event has a moment as
         the current one rather than flicking past. */
      end: () => `+=${distance() * 1.5}`,
      pin,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const next = Math.round(self.progress * last);
        if (next === active) return;
        active = next;
        section.dispatchEvent(new CustomEvent("timeline:active", { detail: next }));
      },
    },
  });

  /* A focused element makes the browser scroll its overflow-hidden
     container to reveal it — an offset ON TOP of the row's transform,
     which would push the card off the other side. The row is moved only
     by the transform here, so the window's own scroll stays at zero. */
  const holdScroll = () => {
    if (viewport.scrollLeft) viewport.scrollLeft = 0;
  };
  viewport.addEventListener("scroll", holdScroll);

  const onFocus = (event) => {
    holdScroll();
    const st = tween.scrollTrigger;
    const index = items.findIndex((item) => item.contains(event.target));
    if (!st || index < 0 || index === active) return;
    jumpTo(st.start + (st.end - st.start) * (index / last));
  };
  section.addEventListener("focusin", onFocus);

  return () => {
    section.removeEventListener("focusin", onFocus);
    viewport.removeEventListener("scroll", holdScroll);
    delete section.dataset.timelinePinned;
  };
}
