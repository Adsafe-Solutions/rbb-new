import { useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import HighlightText from "../HighlightText/HighlightText.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";

/* The homepage hero, set like a poster — and a slideshow: several slides,
   each its own headline, line, button and pair of photographs pinned up
   as prints, one over the other; behind everything, the mark, enormous
   and faint.

   Props, all from content/homepage.js `hero`:
     kicker    the line over the headline (the organisation's name) — fixed
     slides    [{ id, headline: [line], body, cta, image, inset }]
     ctas      { secondary } — the second button, fixed
     controls  the slideshow's labels
     interval  ms each slide stays

   ---------------- Motion ----------------

   The first slide is CSS, at first paint (styles/index.css) — nothing on
   the first screen may wait for the bundle to hydrate:

     · each headline word gets the PRINT PASS (`data-enter-ribbon`): a
       bar of Sky Blue sweeps across it and the word is there behind it
     · the line and the buttons rise in (`data-enter-text` /
       `data-enter-item`). ⚠ The line is `data-enter-text`: on a phone it
       is the page's Largest Contentful Paint, and text that starts at
       opacity 0 is not counted as painted until hydration.

   Changing slides (after hydration): the photographs swap like prints on
   a wall (`data-hero-print`, CSS transitions in styles/index.css), and
   the new slide's text is RE-MOUNTED (its `key` changes), so the same
   CSS entrance — the print pass — plays again. No GSAP: this is the
   first screen, outside the scanner's reach on purpose.

   ⚠ The MAIN PHOTOGRAPH OF SLIDE ONE IS NEVER HIDDEN at load. It is the
   largest thing on the page; it is simply there, and the others wait
   invisibly behind it.

   ---------------- The slideshow ----------------

   Auto-advances every `interval`, and stops for anyone who might be
   reading or using it: while the pointer is over the hero, while focus
   is inside it, while the tab is hidden, and for good once the visitor
   presses pause or picks a slide (WCAG 2.2.2: moving content can be
   paused). With reduced motion it never auto-advances; the slides are
   still there to step through.

   Every slide's text is in the DOM, stacked in one grid cell, so the
   hero is as tall as its tallest slide and the page below never jumps.
   Only the current one is visible and in the accessibility tree; its
   headline is the page's <h1>. A carousel by the WAI pattern: a region
   with `aria-roledescription`, slides labelled "n of N", and the live
   region polite only once the visitor has taken control.

   On a phone the photographs come FIRST, then the kicker, then the
   headline (RBB's call, Oct 2026) — `order-first`, undone from `lg`.
   The main print is a wider crop there (4:3) so the headline still
   reaches the first screen.

   The band clips its own overhang (`overflow-clip` — see Section for why
   not `hidden`): the watermark and the tilted prints bleed past it. */

function Headline({ lines, as: Tag, className, ...rest }) {
  const last = lines.length - 1;
  return (
    <Tag className={cx("type-poster poster-fit", className)} {...rest}>
      {/* One print pass per WORD, not per line: an authored line that
          wraps would otherwise get one bar the height of two rows. The
          words keep their lines (`block` per line) and their real spaces
          — without them the accessible name runs "all.Stronger". */}
      {lines.map((line, i) => {
        const words = line.split(" ");
        const before = lines.slice(0, i).reduce((n, l) => n + l.split(" ").length, 0);
        return (
          <span key={line} className="block">
            {words.map((word, w) => (
              <span key={w}>
                <span data-enter-ribbon style={{ "--enter-i": before + w }}>
                  <span>
                    {i === last && w === words.length - 1 && words.length > 1 ? (
                      <HighlightText>{word}</HighlightText>
                    ) : (
                      word
                    )}
                  </span>
                </span>
                {w < words.length - 1 ? " " : null}
              </span>
            ))}{" "}
          </span>
        );
      })}
    </Tag>
  );
}

export default function PosterHero({ kicker, slides, ctas, controls, interval = 7000 }) {
  const regionId = useId();
  const total = slides.length;
  const [active, setActive] = useState(0);
  /* Bumped on every change, so the active slide's text re-mounts and its
     entrance plays — even when the same slide comes round again. */
  const [cycle, setCycle] = useState(0);
  const [stopped, setStopped] = useState(false); // the visitor took control
  const [held, setHeld] = useState(false); // hover / focus inside
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const section = useRef(null);

  useEffect(() => {
    setHydrated(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(media.matches);
    const onVisibility = () => setHidden(document.hidden);
    onMotion();
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const go = (index) => {
    setActive((index + total) % total);
    setCycle((c) => c + 1);
  };

  const playing = hydrated && total > 1 && !stopped && !reduced;
  const paused = !playing || held || hidden;

  /* One timer per slide: restarted whenever the slide changes, cleared
     while anything holds it. A held slide starts its full time again
     when released — simpler, and never cuts a reader off. */
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => go(active + 1), interval);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cycle, paused, interval]);

  /* Focus moving OUT of the hero releases it; moving within does not. */
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
  };

  const pick = (index) => {
    setStopped(true);
    if (index !== active) go(index);
  };


  return (
    <section
      ref={section}
      data-tone="paper"
      aria-roledescription="carousel"
      aria-label={controls.label}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={onBlur}
      className="relative -mt-[var(--header-h)] overflow-clip pt-[var(--header-h)] lg:min-h-[min(100svh,58rem)]"
    >
      <Mark className="pointer-events-none absolute left-1/2 top-[4%] h-[min(110vw,52rem)] w-[min(110vw,52rem)] -translate-x-[30%] -rotate-[8deg] text-trust-blue opacity-[0.05]" />

      <Container className="relative grid items-center gap-10 pb-20 pt-8 md:gap-14 md:pt-16 lg:min-h-[calc(min(100svh,58rem)-var(--header-h))] lg:grid-cols-[7fr_5fr] lg:gap-10 lg:pb-24 lg:pt-6">
        <div>
          <SectionKicker data-enter-item>{kicker}</SectionKicker>

          {/* Every slide's text in ONE grid cell: the cell is as tall as
              the tallest, so nothing below moves when the slide changes. */}
          <div id={regionId} aria-live={stopped ? "polite" : "off"} className="grid">
            {slides.map((s, i) => {
              const current = i === active;
              return (
                <div
                  /* The current slide re-mounts on every change, which is
                     what replays its CSS entrance. */
                  key={current ? `${s.id}-${cycle}` : s.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={controls.slide(i + 1, total)}
                  aria-hidden={current ? undefined : true}
                  className={cx("[grid-area:1/1] self-start", !current && "invisible")}
                >
                  <Headline lines={s.headline} as={current ? "h1" : "p"} className="mt-6" />
                  {s.body && (
                    <p
                      data-enter-text
                      style={{ "--enter-i": 1 }}
                      className="type-lead mt-8 max-w-[38ch] text-copy"
                    >
                      {s.body}
                    </p>
                  )}
                  {/* Each slide carries its own buttons, so they sit right
                      under its text whatever its length; the spare height
                      of a shorter slide falls below them. An idle slide is
                      `invisible`, so its buttons take no focus or clicks. */}
                  <div
                    data-enter-item
                    style={{ "--enter-i": 2 }}
                    className="mt-9 flex flex-wrap items-center gap-4"
                  >
                    <Button size="lg" to={s.cta.to}>
                      {s.cta.label}
                    </Button>
                    <Button size="lg" variant="outline" to={ctas.secondary.to}>
                      {ctas.secondary.label}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {total > 1 && (
            /* The controls: a segment per slide (a button each, the
               current one filling over its time), and pause / play. */
            <div
              data-enter-item
              style={{ "--enter-i": 3, "--hero-interval": `${interval}ms` }}
              data-paused={paused ? "" : undefined}
              className="mt-10 flex items-center gap-4"
            >
              <ol className="flex flex-1 items-center gap-2 sm:max-w-xs">
                {slides.map((s, i) => (
                  <li key={s.id} className="flex-1">
                    <button
                      type="button"
                      aria-controls={regionId}
                      aria-current={i === active ? "true" : undefined}
                      aria-label={controls.goTo(i + 1, s.headline.join(" "))}
                      onClick={() => pick(i)}
                      /* A 24px hit area around a 4px bar (WCAG 2.2 target
                         size). */
                      className="group block w-full cursor-pointer py-2.5"
                    >
                      <span className="relative block h-1 overflow-hidden rounded-full bg-hair transition-colors group-hover:bg-edge/40">
                        {i === active && (
                          <span
                            key={`${s.id}-${cycle}`}
                            data-hero-progress={playing ? "" : undefined}
                            className={cx("absolute inset-0 rounded-full bg-pop", !playing && "scale-x-100")}
                          />
                        )}
                        {i < active && <span className="absolute inset-0 rounded-full bg-edge/50" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="type-meta shrink-0 text-quiet" aria-hidden="true">
                {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </p>
              {!reduced && (
                <button
                  type="button"
                  onClick={() => setStopped((v) => !v)}
                  aria-label={stopped ? controls.play : controls.pause}
                  className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-edge text-fg transition-colors hover:bg-flip hover:text-on-flip"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                    {stopped ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* The prints, every slide's stacked in one cell: the current pair
            shown, the rest waiting invisibly (styles/index.css
            `data-hero-print`). Slide one's main print is the LCP image —
            fetched first, never hidden; the others load lazily. The inset
            hangs over the main print's lower-left corner at the opposite
            tilt; from `sm` up it is pulled out past the frame's edge, on
            a phone it stays inside the gutter. */}
        <div className="relative order-first mx-auto w-full max-w-[30rem] pb-10 pl-8 sm:pl-14 lg:order-none lg:max-w-none lg:pb-14">
          <div className="grid" data-parallax="5">
            {slides.map((s, i) => (
              <div
                key={s.id}
                data-hero-print="main"
                data-state={i === active ? "active" : "idle"}
                aria-hidden={i === active ? undefined : true}
                className="[grid-area:1/1]"
              >
                <EditorialImage
                  image={s.image}
                  ratio="aspect-[4/3] lg:aspect-[4/5]"
                  tilt="r-lg"
                  cast="cast-lg"
                  priority={i === 0}
                  sizes="(min-width: 1024px) 38vw, 88vw"
                />
              </div>
            ))}
          </div>
          {slides.map(
            (s, i) =>
              s.inset && (
                <div
                  key={s.id}
                  data-hero-print="inset"
                  data-state={i === active ? "active" : "idle"}
                  aria-hidden={i === active ? undefined : true}
                  className="absolute bottom-0 left-0 w-[46%]"
                >
                  <EditorialImage
                    image={s.inset}
                    ratio="aspect-square"
                    tilt="l-lg"
                    sizes="(min-width: 1024px) 18vw, 40vw"
                  />
                </div>
              )
          )}
        </div>
      </Container>

      <div
        aria-hidden="true"
        className="scroll-cue absolute bottom-6 left-1/2 hidden h-10 w-0.5 -translate-x-1/2 lg:block"
      />
    </section>
  );
}
