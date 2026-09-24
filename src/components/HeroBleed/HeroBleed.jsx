import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import Picture from "../Picture/Picture.jsx";

/* The homepage hero: the headline on a Deep Trust Blue band on the left,
   one photograph running full height on the right, and the two meeting in
   a wide feathered seam rather than at an edge.

   The seam is the whole trick. The photograph is laid across a good deal
   more than the half it appears to occupy, and a blue gradient is drawn
   back over its left side — so the image does not stop anywhere, it simply
   runs out. A hard 50/50 split would make this an ordinary two-column
   layout with a picture in one of them.

   It used to rotate three slides, each with its own headline. Document 02
   gives the homepage ONE headline, and rotating photographs under a fixed
   headline is motion with nothing to say — so it holds still. Nothing on
   this band moves on its own; the reveal on the copy is the only motion,
   and the reduced-motion rule turns that off.

   Everything comes in as props from content/homepage.js:
     headline  lines of the <h1>; the LAST line takes the Sky Blue accent
     body      the supporting line
     ctas      { primary, secondary }, each { label, to }
     image     { src, alt, focal } — `focal` is its object-position

   ⚠ Below `lg` the photograph is NOT behind the copy — it drops into flow
   as a band underneath and the scrim is switched off. Holding it behind
   the headline on a phone needs a scrim near 90% before body copy is
   legible, and at 90% there is no photograph left to look at.

   Everything decorative here is `aria-hidden`, and none of it may widen
   the page: the band carries `overflow-hidden` for that, which is safe on
   a <section> — on `body` it would create a scroll container and silently
   break sticky positioning (see styles/index.css). */

/* The seam, from `lg` up only. Stops are set from where the copy column
   ends — about a quarter of the way across the photograph at desktop
   widths — so the colour is solid to 22% and the picture's from 56%. It
   is Deep Trust Blue, the band's own ground, so the solid end of the
   gradient is indistinguishable from the band and the photograph appears
   to rise out of it. */
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
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function HeroBleed({ headline, body, ctas, image }) {
  const lead = headline.slice(0, -1);
  const accent = headline[headline.length - 1];

  return (
    /* `lg:min-h` rather than letting the copy set the height: the
       photograph is `object-cover`, so a short band crops it down to one
       person's shoulder. A floor lets it breathe. */
    <section className="relative -mt-[var(--header-h)] overflow-hidden bg-trust-blue pt-[var(--header-h)] lg:min-h-[44rem]">
      {/* The mark, oversized and pale, bled off the left edge behind the
          copy, where it has nothing but blue underneath it. */}
      <Mark className="pointer-events-none absolute -left-[10%] top-1/2 z-0 hidden h-[34vw] w-[34vw] max-h-[34rem] max-w-[34rem] -translate-y-1/2 text-paper-white/[0.06] lg:block" />

      <Container className="relative z-10">
        <div className="reveal max-w-xl py-14 md:py-20 lg:max-w-[42rem] lg:py-28">
          {/* `text-paper-white` on the h1 ITSELF: styles/index.css sets
              :where(h1,h2,h3,h4) to Deep Trust Blue, which on this band is
              Deep Trust Blue on Deep Trust Blue. */}
          <h1 className="text-[length:clamp(2.5rem,4.6vw,4rem)] font-bold leading-[1.05] tracking-heading-lg text-paper-white">
            {/* The spaces between lines are real text: `block` breaks
                the lines visually, but without them the accessible name
                runs "Hope.Creating". */}
            {lead.map((line) => (
              <span key={line}>
                <span className="block">{line}</span>{" "}
              </span>
            ))}
            <span className="block text-bumble-honey">{accent}</span>
          </h1>

          <p className="mt-6 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-paper-white/85">
            {body}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button to={ctas.primary.to} className="group gap-3">
              {ctas.primary.label}
              <ArrowIcon />
            </Button>
            <Button variant="outlineInverse" to={ctas.secondary.to}>
              {ctas.secondary.label}
            </Button>
          </div>
        </div>
      </Container>

      {/* The photograph. Absolutely placed and wider than the column it
          appears to fill from `lg` up, so the scrim fades ACROSS it; below
          that, an ordinary band in flow under the copy.

          ⚠ Which is why the copy's Container carries `z-10`: absolutely
          placed and later in source order, this would otherwise paint over
          the headline. */}
      <div className="relative z-0 h-[18rem] w-full sm:h-[26rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[70%]">
        <Picture
          sizes="(min-width: 1024px) 70vw, 100vw"
          src={image.src}
          alt={image.alt}
          /* The LCP element — never lazy, fetched ahead of the rest.
             ⚠ Lowercase `fetchpriority`: React 18 drops the camelCase
             spelling with a warning; lowercase passes straight through. */
          fetchpriority="high"
          decoding="async"
          /* A style, not a class: `object-[${focal}]` would never be
             generated, because Tailwind only emits literal class strings. */
          style={{ objectPosition: image.focal }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden="true" className={`absolute inset-0 ${SCRIM}`} />
      </div>
    </section>
  );
}
