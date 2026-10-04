import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import HighlightText from "../HighlightText/HighlightText.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";

/* The homepage hero, set like a poster: the headline at the largest size
   the system has, one short line per row, the last word of it on the
   accent; beside it two photographs pinned up as prints, one over the
   other; behind everything, the mark, enormous and faint.

   Props, all from content/homepage.js:
     kicker    the line over the headline (the organisation's name)
     headline  the <h1>, one entry per line
     body      the supporting line
     ctas      { primary, secondary }
     image     the main photograph — the page's largest image
     inset     a second photograph, overlapping the first's corner

   ---------------- Motion ----------------

   All of it CSS, at first paint (styles/index.css) — nothing on the
   first screen may wait for the bundle to hydrate:

     · each headline word gets the PRINT PASS (`data-enter-ribbon`): a
       bar of Sky Blue sweeps across it and the word is there behind it
       when it leaves, word after word
     · the line, the buttons and the inset print rise in alongside it
       (`data-enter-item`). ⚠ The line is `data-enter-text` and goes
       FIRST: on a phone it is the page's Largest Contentful Paint, and
       text that starts at opacity 0 is not counted as painted until the
       bundle hydrates (styles/index.css).
     · the scroll cue's segment falls through its hairline

   ⚠ The MAIN PHOTOGRAPH IS NEVER HIDDEN. It is the largest thing on the
   page, and fading it in would trade the number that measures how fast
   the site feels for an effect. Its only motion is a few percent of
   drift against the scroll (`data-parallax`), which the scanner adds
   later and which costs the paint nothing.

   Reduced motion: the site-wide rule collapses every animation to its
   end — the headline is simply there, with no bar.

   The band clips its own overhang (`overflow-clip` — see Section for why
   not `hidden`): the watermark and the tilted prints bleed past it. */
export default function PosterHero({ kicker, headline, body, ctas, image, inset }) {
  const last = headline.length - 1;

  return (
    <section
      data-tone="paper"
      className="relative -mt-[var(--header-h)] overflow-clip pt-[var(--header-h)] lg:min-h-[min(100svh,58rem)]"
    >
      <Mark className="pointer-events-none absolute left-1/2 top-[4%] h-[min(110vw,52rem)] w-[min(110vw,52rem)] -translate-x-[30%] -rotate-[8deg] text-trust-blue opacity-[0.05]" />

      <Container className="relative grid items-center gap-14 pb-20 pt-10 md:pt-16 lg:min-h-[calc(min(100svh,58rem)-var(--header-h))] lg:grid-cols-[7fr_5fr] lg:gap-10 lg:pb-24 lg:pt-6">
        <div>
          <SectionKicker data-enter-item>{kicker}</SectionKicker>

          {/* The spaces between lines are real text: `block` breaks the
              lines visually, but without them the accessible name runs
              "Hope.Creating". */}
          {/* One print pass per WORD, not per line: an authored line that
              wraps ("Creating / Change.") would otherwise get one bar the
              height of two rows — a slab, not a stroke. The words keep
              their lines (`block` per line) and their real spaces. */}
          <h1 className="type-poster poster-fit mt-6">
            {headline.map((line, i) => {
              const words = line.split(" ");
              const before = headline
                .slice(0, i)
                .reduce((n, l) => n + l.split(" ").length, 0);
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
          </h1>

          {body && (
            <p
              data-enter-text
              style={{ "--enter-i": 1 }}
              className="type-lead mt-8 max-w-[38ch] text-copy"
            >
              {body}
            </p>
          )}

          <div
            data-enter-item
            style={{ "--enter-i": 2 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Button size="lg" to={ctas.primary.to}>
              {ctas.primary.label}
            </Button>
            <Button size="lg" variant="outline" to={ctas.secondary.to}>
              {ctas.secondary.label}
            </Button>
          </div>
        </div>

        {/* Two prints. The main one is the LCP image — fetched first, never
            hidden. The inset hangs over its lower-left corner at the
            opposite tilt; from `sm` up it is pulled out past the frame's
            edge, on a phone it stays inside the gutter. */}
        <div className="relative mx-auto w-full max-w-[30rem] pb-10 pl-8 sm:pl-14 lg:max-w-none lg:pb-14">
          <EditorialImage
            image={image}
            ratio="aspect-[4/5]"
            tilt="r-lg"
            cast="cast-lg"
            priority
            sizes="(min-width: 1024px) 38vw, 88vw"
            data-parallax="5"
          />
          {inset && (
            <div
              data-enter-item
              style={{ "--enter-i": 3 }}
              className="absolute bottom-0 left-0 w-[46%]"
            >
              <EditorialImage
                image={inset}
                ratio="aspect-square"
                tilt="l-lg"
                sizes="(min-width: 1024px) 18vw, 40vw"
              />
            </div>
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
