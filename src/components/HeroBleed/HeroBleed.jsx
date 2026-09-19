import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import { cx } from "../../lib/cx.js";
import { HERO_BLEED } from "../../content/index.js";

/* The alternate hero: the photograph runs the full height of the band on
   the right, the copy sits on a Deep Trust Blue ground on the left, and
   the two meet in a wide feathered seam rather than at an edge.

   The seam is the whole trick. The photograph is laid across a good deal
   more than the half it appears to occupy, and a blue gradient is drawn
   back over its left side — so the image does not stop anywhere, it simply
   runs out. A hard 50/50 split would make this an ordinary two-column
   layout with a picture in one of them.

   It rotates. Each slide is a photograph AND the words that go with it
   (content/home.js), because a headline about clean water over a picture
   of a litter pick is worse than no rotation at all. The photographs
   cross-fade; the copy rises into place and settles back out — see RISE
   AND SET below.

   There is no drawn "People Beyond Borders" signature over the picture any
   more. It was here, in the top right, until the photography was replaced
   with RBB's own field images — which carry the mark, the wordmark and
   that exact strapline ON A BANNER inside the frame. The script landed on
   top of the real thing: two wordmarks, one corner. The photograph says it
   better than an overlay could. If it ever comes back it belongs on the
   blue side, not over the picture.

   ⚠ Below `lg` the photograph is NOT behind the copy — it drops into flow
   as a band underneath it and the scrim is switched off. Holding it behind
   the headline on a phone was tried: the scrim has to reach about 90%
   opacity before body copy is legible over a patterned dress, and at 90%
   there is no photograph left to look at. Stacked, both survive — the copy
   on the band's blue, the photograph in full beneath it.

   Everything decorative here is `aria-hidden` and none of it may widen the
   page: the band carries `overflow-hidden` for that, which is safe on a
   <section> — on `body` it would create a scroll container and silently
   break the header's `position: sticky` (see styles/index.css). */

const SLIDES = HERO_BLEED.slides;

/* How long a slide holds once its copy has arrived, and how long that copy
   takes to settle out before the next one rises. HOLD is generous on
   purpose: the body paragraph runs to three lines, and a hero that changes
   under someone mid-sentence is a hero nobody finishes reading. */
const HOLD_MS = 6500;
const SET_MS = 620;

/* ---------------- RISE AND SET ----------------

   The copy is NOT re-keyed per slide. The same elements stay mounted and
   only their text changes, and that is the entire reason the transition
   works: an element React remounts renders straight into its resting
   position with nothing to animate from. Key any of this by slide and the
   words will change without ever moving.

   Resting is `translate-y-0 opacity-100`. Both ends of the cycle are the
   same pose BELOW it — so the outgoing words sink and fade (setting) and
   the incoming words climb back up out of the same place (rising). One
   pose, two directions, and no separate enter and exit states to keep in
   step with each other. */
const COPY_BASE = "transition-[transform,opacity] duration-[620ms] ease-out";
const COPY_RISEN = "translate-y-0 opacity-100";
const COPY_SET = "translate-y-8 opacity-0";

/* Each line leaves a beat after the one above it, so the block rises as a
   sequence rather than a slab. On the way up only — a staggered exit reads
   as the layout coming apart rather than as one thing leaving. */
const STAGGER_MS = 90;

/* The seam, from `lg` up only.

   The stops are set from where the COPY actually ends, not by eye. At
   1512px the panel starts at x≈423 and the copy column runs out by x≈700
   — about a quarter of the way across the panel. So the colour only has
   to be solid to 22%, and everything past that is the photograph's.

   It is Deep Trust Blue, not white. A white fade read as the photograph
   being washed out; the brand's own dark blue reads as the band and the
   picture meeting. It also matches the section's ground (bg-trust-blue
   on the <section>), so the solid end of the gradient is indistinguishable
   from the band itself and the photograph appears to rise out of it.
   The 32 points between 22% and 54% are ~350px of gradient — shorten that
   range and a seam appears. */
const SCRIM = [
  "hidden lg:block",
  "bg-gradient-to-r from-trust-blue from-22%",
  "via-trust-blue/75 via-36% to-transparent to-56%",
].join(" ");

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-bumble-honey/15 text-bumble-honey"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  );
}

export default function HeroBleed() {
  const [index, setIndex] = useState(0);
  const [risen, setRisen] = useState(true);
  /* Where a dot press wants to go, held until the current copy has set. */
  const [pending, setPending] = useState(null);
  /* Keyboard focus inside the band stops the clock — someone tabbing
     towards the buttons should not have the thing they are aiming at
     change underneath them.

     ⚠ NOT hover. Pausing on hover is the usual reflex for a carousel and
     it is wrong here: this band is the full height of the viewport, so
     every resting cursor position is over it and the slides simply never
     advanced. The pause was permanent and looked like a broken timer. */
  const [held, setHeld] = useState(false);

  /* Read once. Calling matchMedia in render would re-evaluate on every
     pass, and this decides whether a timer exists at all rather than how
     anything looks. */
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  /* Hold, then set. Under reduced motion nothing advances on its own and
     the dots are the only way through — which is the point of them. */
  useEffect(() => {
    if (!risen || held || reduced || SLIDES.length < 2) return;

    const timer = window.setTimeout(() => setRisen(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [risen, held, reduced, index]);

  /* Once it has set, swap the words underneath and let them rise again.
     The photograph changes on this same tick, so the cross-fade happens
     while the copy is out of the way rather than behind it. */
  useEffect(() => {
    if (risen) return;

    const timer = window.setTimeout(() => {
      setIndex((current) => pending ?? (current + 1) % SLIDES.length);
      setPending(null);
      setRisen(true);
    }, SET_MS);
    return () => window.clearTimeout(timer);
  }, [risen, pending]);

  const goTo = (next) => {
    if (next === index) return;
    setPending(next);
    setRisen(false);
  };

  const slide = SLIDES[index];

  /* The props that put one line of copy in the cycle. `order` is its place
     in the stagger, counted from the top of the block. */
  const rise = (order, className) => ({
    className: cx(className, COPY_BASE, risen ? COPY_RISEN : COPY_SET),
    style: { transitionDelay: risen ? `${order * STAGGER_MS}ms` : "0ms" },
  });

  /* The accent line and the paragraph sit after the headline's own lines,
     so their place in the stagger follows from however many there are. */
  const accentOrder = slide.headline.length + 1;

  return (
    /* `lg:min-h` rather than letting the copy set the height. The
       photograph is `object-cover`, so every extra pixel of band height
       crops further into it — at the natural height of this much copy the
       image was down to one person's shoulder. A floor lets it breathe,
       and the copy still grows the band past it if it ever needs to. */
    <section
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      className="relative -mt-[var(--header-h)] overflow-hidden bg-trust-blue pt-[var(--header-h)] lg:min-h-[46rem]"
    >
      {/* The mark, oversized and pale, bled off the LEFT edge behind the
          copy. It sat in the seam before, where it covered the middle of
          the photograph — the one part of the band already doing a job.
          Over here it has nothing but white underneath it. */}
      <Mark className="pointer-events-none absolute -left-[10%] top-1/2 z-0 hidden h-[34vw] w-[34vw] max-h-[34rem] max-w-[34rem] -translate-y-1/2 text-paper-white/[0.06] lg:block" />

      <Container className="relative z-10">
        <div className="reveal max-w-xl py-14 md:py-20 lg:max-w-[38rem] lg:py-24">
          {/* The kicker. The dots are drawn BETWEEN the items rather than
              typed into the copy, so what a screen reader gets is three
              phrases and not a run of bullet characters.

              ⚠ Each dot TRAILS its phrase rather than leading the next one.
              On a phone this line wraps, and a leading dot puts a stray
              bullet at the start of the second line; a trailing one ends
              the first line the way a dash would. */}
          <p
            {...rise(
              0,
              "flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-caption)] font-medium uppercase tracking-[0.18em] text-bumble-honey"
            )}
          >
            {slide.kicker.map((part, i) => (
              <span key={i} className="flex items-center gap-x-3">
                {part}
                {i < slide.kicker.length - 1 && (
                  <span aria-hidden="true" className="text-bumble-honey/60">
                    •
                  </span>
                )}
              </span>
            ))}
          </p>

          {/* Keyed by POSITION, never by the words — see RISE AND SET. These
              elements have to survive the slide change for the transition
              to have anything to run from. */}
          {/* `text-paper-white` on the h1 ITSELF: styles/index.css sets
              :where(h1,h2,h3,h4) to Deep Trust Blue, and a colour declared
              on the element beats one inherited from a wrapper — on this
              band that is Deep Trust Blue on Deep Trust Blue. */}
          <h1 className="mt-6 text-[length:clamp(2.5rem,5.2vw,4rem)] font-bold leading-[1.05] tracking-heading-lg text-paper-white">
            {slide.headline.map((line, i) => (
              <span key={i} {...rise(i + 1, "block")}>
                {line}
              </span>
            ))}
            {/* The one accented line. Sky Blue against the white of the
                rest of the headline — the palette's own emphasis, not a
                highlight colour. */}
            <span {...rise(accentOrder, "block text-bumble-honey")}>
              {slide.headlineAccent}
            </span>
          </h1>

          <p {...rise(accentOrder + 1, "mt-6 max-w-prose text-paper-white/80")}>
            {slide.body}
          </p>

          {/* From here down nothing rotates. The calls to action are the
              same whichever slide is up, and moving them every few seconds
              would make the band look like it keeps reloading. */}
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button to={HERO_BLEED.ctas.primary.to} className="gap-3">
              {HERO_BLEED.ctas.primary.label}
              <ArrowIcon />
            </Button>
            <Button
              variant="outlineInverse"
              to={HERO_BLEED.ctas.secondary.to}
              className="gap-3 py-3 pl-3"
            >
              <PlayIcon />
              {HERO_BLEED.ctas.secondary.label}
            </Button>
          </div>

          <div className="mt-12 flex items-center gap-8">
            {/* Real buttons. The band advances itself, so without these the
                second and third slides are unreachable for anyone who
                cannot wait — and for everyone under reduced motion, where
                nothing advances at all. The label is the slide's own
                headline, which is the only description of it that exists. */}
            <div
              onMouseEnter={() => setHeld(true)}
              onMouseLeave={() => setHeld(false)}
              className="flex items-center gap-2.5"
            >
              {SLIDES.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`${item.headline.join(" ")} ${item.headlineAccent}`}
                  aria-current={i === index}
                  className={cx(
                    "h-2 cursor-pointer rounded-full transition-[width,background-color] duration-300",
                    i === index
                      ? "w-8 bg-bumble-honey"
                      : "w-2 bg-paper-white/30 hover:bg-paper-white/60"
                  )}
                />
              ))}
            </div>

            {/* The scroll cue. Decorative — the page scrolls whether or not
                anyone reads this — so it is hidden from assistive tech
                rather than announced as an instruction nobody can act on. */}
            <p
              aria-hidden="true"
              className="hidden items-center gap-4 text-[length:var(--text-caption)] uppercase tracking-[0.2em] text-paper-white/70 lg:flex"
            >
              <svg
                viewBox="0 0 12 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                className="h-10 w-3 animate-[bounce_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
              >
                <path d="M6 1v34M1.5 30 6 35l4.5-5" />
              </svg>
              {HERO_BLEED.scrollLabel}
            </p>
          </div>
        </div>
      </Container>

      {/* The photographs. Absolutely placed and wider than the column they
          appear to fill from `lg` up, so the scrim has room to fade ACROSS
          them rather than stopping at a line; below that this is an
          ordinary band in flow under the copy. They come after the copy in
          source order for exactly that reason.

          ⚠ Which is also why every OTHER child of this band carries
          `z-10`. Source order decides painting between positioned
          siblings, so absolutely placed and declared last, the photographs
          would cover the headline outright. */}
      <div className="relative z-0 h-[20rem] w-full sm:h-[26rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[72%]">
        {SLIDES.map((item, i) => (
          <img
            key={item.src}
            src={item.src}
            /* Only the one on screen describes itself. Three alt texts
               announced at once is three photographs as far as a screen
               reader is concerned, and two of them are invisible. */
            alt={i === index ? item.alt : ""}
            /* The first is the LCP element on this variant — never lazy,
               and fetched ahead of the rest of the page's images. The
               others are a full hold away.

               ⚠ Lowercase `fetchpriority`. React 18 does not know this
               attribute, so the camelCase spelling is dropped with a
               console warning instead of reaching the DOM; lowercase
               passes straight through. React 19 adds `fetchPriority`. */
            fetchpriority={i === 0 ? "high" : undefined}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            /* The focal point comes from content, per slide — the subject
               is not in the same place in every frame and the left third
               of this panel is under the scrim. An inline style, not a
               class: Tailwind only emits utilities it can find as literal
               strings, so `object-[${item.focal}]` would compile, render,
               and position nothing. */
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-out"
            style={{ objectPosition: item.focal, opacity: i === index ? 1 : 0 }}
          />
        ))}
        <div aria-hidden="true" className={`absolute inset-0 ${SCRIM}`} />
      </div>

      {/* The note card over the photograph's lower corner — but only from
          `lg`, where the copy is confined to the left column and there is a
          corner to sit in. Below that it drops back into flow as its own
          row under the hero, because absolutely positioned it would land on
          the copy.

          `-mt-10` below `lg`: the card laps onto the bottom of the
          photograph band, which is what stops it reading as a third stacked
          block after the image.

          ⚠ `pointer-events-none` on the Container, `auto` on the card. From
          `lg` the Container is absolute and full width, so its box reaches
          across the whole band at that height whatever the card inside it
          is doing — and at `z-10` it swallowed every click on the slide
          dots in the left column. Nothing was visibly on top of them;
          an invisible box was. */}
      <Container className="pointer-events-none relative z-10 -mt-10 pb-12 lg:absolute lg:inset-x-0 lg:bottom-10 lg:mt-0 lg:pb-0">
        <Link
          to={HERO_BLEED.note.to}
          className="pointer-events-auto ml-auto flex max-w-md items-center gap-4 rounded-3xl bg-paper-white p-4 shadow-sm transition-colors hover:bg-mist"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bumble-honey/12 text-bumble-honey">
            <GlobeIcon />
          </span>
          <span className="flex-1 text-[length:var(--text-caption)] leading-caption tracking-caption text-bumble-ink">
            {HERO_BLEED.note.text}
          </span>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bumble-honey/12 text-bumble-honey"
          >
            <ArrowIcon />
          </span>
        </Link>
      </Container>
    </section>
  );
}
