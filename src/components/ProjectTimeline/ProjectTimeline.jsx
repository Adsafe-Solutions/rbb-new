import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* Recent project highlights: a row of cards that moves sideways as the
   page scrolls down, over a timeline that fills in as it goes.

   HOW THE SCROLL WORKS. The section is made exactly as tall as the pinned
   panel plus SCROLL_RATIO times the distance the row has to travel, and
   the panel is `sticky` inside it. While the panel is pinned, every
   SCROLL_RATIO pixels scrolled down move the row one pixel left, and the
   row eases toward that position rather than jumping to it — so the
   reader's scroll wheel is still the only clock, the row just follows it
   at a walk and settles a moment after they stop.

   The timeline lives INSIDE the moving track, in columns the same width
   as the cards, so each dot stays under its own card rather than being a
   separate bar that has to be kept in step.

   While pinned, the photograph is the one part of a card with no fixed
   height: it takes whatever the panel has left after the copy, buttons
   and timeline. A fixed aspect ratio would need ~880px of screen to fit,
   which rules out most laptops; this way a tall screen gets a bigger
   photo and a short one a smaller photo, and everything else is always
   on screen. The row is capped so a very tall screen does not get
   poster-sized cards.

   ⚠ Pinning still needs SOME room. Below MIN_PIN_HEIGHT (a phone on its
   side) the photo would be squeezed to nothing, so the section falls back
   to an ordinary swipeable row with fixed-ratio photos, the timeline
   driven by that row's own scroll instead of the page's.

   ⚠ No `.reveal` inside the track. useReveal's observer works off the
   element's position in the page, and a card that enters by sliding
   sideways inside a pinned panel never crosses its threshold. */
const MIN_PIN_HEIGHT = "(min-height: 46rem)";

/* Page pixels scrolled per pixel the row moves. 1 read as a flick — a
   single wheel notch sent a card and a half past — and 2.5 still read as
   hurried. Raise it to slow the row further; the section just gets
   taller. */
const SCROLL_RATIO = 4;

/* Fraction of the remaining distance the row covers each frame. Lower is
   floatier; 1 turns the easing off. */
const EASE = 0.06;

export default function ProjectTimeline({ heading, items }) {
  const sectionRef = useRef(null);
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const fillRef = useRef(null);

  const [pinned, setPinned] = useState(true);
  /* The distance the row travels, which is also the extra page height the
     section adds. Measured, never guessed: it depends on the card count,
     the card width at this breakpoint, and the window. */
  const [travel, setTravel] = useState(0);
  /* How many dots the fill has reached. The only per-scroll value that
     goes through React — it changes a handful of times across the whole
     section, where the transform and the fill change every frame and are
     written straight to the DOM. */
  const [reached, setReached] = useState(1);
  /* The card the row is currently on — the dot nearest the fill's head.
     It gets the Sky Blue border, so the eye has one card to land on while
     the row is moving. Rounded where `reached` floors: a card becomes
     active as the fill approaches it, not only once it has arrived. */
  const [active, setActive] = useState(0);

  const last = items.length - 1;

  const paint = useCallback(
    (progress) => {
      const p = Math.min(1, Math.max(0, progress));
      if (pinned && trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-p * travel}px, 0, 0)`;
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      /* A dot lights when the fill reaches its centre; the small epsilon
         stops the last one flickering on sub-pixel rounding at p = 1. */
      setReached(Math.floor(p * last + 0.001) + 1);
      setActive(Math.round(p * last));
    },
    [pinned, travel, last]
  );

  useEffect(() => {
    const mq = window.matchMedia(MIN_PIN_HEIGHT);
    const sync = () => setPinned(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Measure before paint so the page never shows the section at the wrong
     height for a frame. The track's side padding is set to the heading's
     own left edge, so the first card lines up with the Container column
     at every width — including the 1320px cap, which a vw-based calc
     would miss by the width of the scrollbar. */
  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const viewport = viewportRef.current;
      const head = headingRef.current;
      if (!track || !viewport || !head) return;

      const inset = head.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
      track.style.paddingInline = `${inset}px`;
      /* Swipe mode snaps cards to the same column edge. */
      viewport.style.scrollPaddingInline = `${inset}px`;
      setTravel(Math.max(0, track.offsetWidth - viewport.clientWidth));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewportRef.current);
    ro.observe(headingRef.current);
    return () => ro.disconnect();
  }, [pinned, items.length]);

  /* Pinned: progress is how far the page has scrolled through the
     section's extra height. */
  useEffect(() => {
    if (!pinned) return undefined;
    let frame = 0;
    let current = null;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = () => {
      const section = sectionRef.current;
      if (!section || !travel) return 0;
      const header = parseFloat(getComputedStyle(section).getPropertyValue("--header-h")) || 0;
      const scrolled = header - section.getBoundingClientRect().top;
      return Math.min(1, Math.max(0, scrolled / (travel * SCROLL_RATIO)));
    };

    /* Runs only while the row is catching up, then stops — no loop
       ticking away while the page sits still. */
    const update = () => {
      frame = 0;
      const goal = target();
      if (current === null || still) current = goal;
      else current += (goal - current) * EASE;
      if (Math.abs(goal - current) * travel < 0.5) current = goal;
      paint(current);
      if (current !== goal) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pinned, travel, paint]);

  /* Unpinned: progress is the swipeable row's own scroll. The transform
     from pinned mode is cleared so the two never stack. */
  useEffect(() => {
    if (pinned) return undefined;
    const viewport = viewportRef.current;
    if (trackRef.current) trackRef.current.style.transform = "";

    const onScroll = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      paint(max ? viewport.scrollLeft / max : 0);
    };
    onScroll();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [pinned, paint]);

  /* Keyboard. Tabbing to a button on a card that is still off to the
     right makes the browser scroll the clipped panel itself to show it —
     an overflow:hidden box is still programmatically scrollable — which
     would leave the row and the page disagreeing about where we are.
     Undo that, and scroll the PAGE to the point where that card is in
     view instead, so the two stay one motion. */
  const onFocusCard = (index) => {
    if (!pinned) return;
    const panel = panelRef.current;
    const section = sectionRef.current;
    const card = trackRef.current?.children[0]?.children[index];
    if (!panel || !section || !card) return;

    panel.scrollLeft = 0;
    const inset = parseFloat(trackRef.current.style.paddingInline) || 0;
    const shift = Math.min(travel, Math.max(0, card.offsetLeft - inset)) * SCROLL_RATIO;
    const header = parseFloat(getComputedStyle(section).getPropertyValue("--header-h")) || 0;
    const top = window.scrollY + section.getBoundingClientRect().top - header + shift;
    /* "instant", not "auto": auto defers to the document's
       `scroll-behavior: smooth`, and a smooth scroll here races the
       browser's own scroll-into-view and stops short of the card. */
    window.scrollTo({ top, behavior: "instant" });
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="project-timeline-heading"
      className="bg-mist"
      style={pinned ? { height: `calc(100svh - var(--header-h) + ${travel * SCROLL_RATIO}px)` } : undefined}
    >
      <div
        ref={panelRef}
        className={cx(
          "flex flex-col py-8",
          pinned &&
            "sticky top-[var(--header-h)] h-[calc(100svh_-_var(--header-h))] justify-center overflow-hidden"
        )}
      >
        <Container className="shrink-0">
          <h2
            ref={headingRef}
            id="project-timeline-heading"
            className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm md:text-[length:var(--text-heading)] md:leading-heading md:tracking-heading"
          >
            {heading}
          </h2>
        </Container>

        <div
          ref={viewportRef}
          className={cx(
            "mt-6 md:mt-8",
            pinned
              ? "flex max-h-[34rem] min-h-0 flex-1"
              : "snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:none]"
          )}
        >
          {/* The card width is one variable so the three rows below —
              cards, rail, dates — stay in the same columns by construction. */}
          <div
            ref={trackRef}
            className="relative flex w-max shrink-0 flex-col [--card:19rem] will-change-transform md:[--card:21rem]"
          >
            <ol className={cx("flex gap-cards", pinned && "min-h-0 flex-1")}>
              {items.map((item, i) => (
                <li
                  key={item.title}
                  onFocus={() => onFocusCard(i)}
                  className="flex w-[var(--card)] snap-start"
                >
                  {/* The active border is a 1px border plus a 1px ring
                      in the same colour, not a 2px border: changing the
                      border width would nudge every card's contents by
                      a pixel as the highlight passes. */}
                  <article
                    aria-current={i === active ? "true" : undefined}
                    className={cx(
                      "flex w-full flex-col overflow-hidden rounded-3xl border bg-paper-white shadow-sm",
                      "transition-[border-color,box-shadow] duration-300",
                      i === active
                        ? "border-bumble-honey ring-1 ring-bumble-honey"
                        : "border-bumble-ink/10"
                    )}
                  >
                    <div
                      className={cx(
                        "relative overflow-hidden border-b border-bumble-ink/10",
                        pinned ? "min-h-24 flex-1" : "aspect-[16/10]"
                      )}
                    >
                      <img
                        src={item.src}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex shrink-0 flex-col p-4">
                      <p className="text-[length:var(--text-caption)] font-medium uppercase tracking-[0.18em] text-bumble-honey">
                        {item.place}
                      </p>
                      {/* Title and body together hold room for their
                          longest case (two lines + three), so every photo
                          in the row comes out the same height. Held on the
                          PAIR rather than each one, so a one-line title
                          does not leave a gap under itself — the spare
                          room falls below the copy, above the buttons. */}
                      <div className="mt-1.5 min-h-[calc(2*var(--text-subheading)*var(--leading-subheading)+0.5rem+3*var(--text-caption)*var(--leading-caption))]">
                        <h3 className="line-clamp-2 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                          {item.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                          {item.body}
                        </p>
                      </div>

                      {/* Side by side at `sm`: one row of buttons instead
                          of two stacked full-size ones hands that height
                          back to the photograph. */}
                      <div className="grid grid-cols-2 gap-2 pt-3">
                        <Button size="sm" to={item.donate.to} className="w-full">
                          {item.donate.label}
                        </Button>
                        <Button size="sm" variant="outline" to={item.more.to} className="w-full">
                          {item.more.label}
                        </Button>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ol>

            {/* The rail runs from the first dot's centre to the last's, so
                a fill of 0 sits on the first dot and a fill of 1 on the
                last. Decorative: the dates below carry the information. */}
            <div aria-hidden="true" className="relative mt-6 h-4 shrink-0">
              <div className="absolute inset-x-[calc(var(--card)/2)] top-1/2 h-1 -translate-y-1/2 rounded-full bg-bumble-ink/10">
                {/* Starts collapsed by inline style, NOT `scale-x-0`: in
                    Tailwind v4 that utility sets the separate CSS `scale`
                    property, which multiplies with the inline transform
                    below and would hold the fill at zero forever. */}
                <div
                  ref={fillRef}
                  style={{ transform: "scaleX(0)" }}
                  className="h-full origin-left rounded-full bg-bumble-honey"
                />
              </div>
              <div className="relative flex gap-cards">
                {items.map((item, i) => (
                  <div key={item.title} className="flex w-[var(--card)] justify-center">
                    <span
                      className={cx(
                        "h-4 w-4 rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-300",
                        i === active && "ring-4 ring-bumble-honey/25",
                        i < reached
                          ? "border-bumble-honey bg-bumble-honey"
                          : "border-bumble-ink/20 bg-paper-white"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <ol className="mt-3 flex shrink-0 gap-cards">
              {items.map((item, i) => (
                <li key={item.title} className="flex w-[var(--card)] justify-center">
                  <time
                    className={cx(
                      "rounded-full border px-3 py-0.5 text-[length:var(--text-caption)] leading-caption font-medium transition-colors duration-300",
                      i < reached
                        ? "border-bumble-honey/40 text-trust-blue"
                        : "border-bumble-ink/10 text-graphite"
                    )}
                  >
                    {item.date}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
