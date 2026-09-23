import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import { cx } from "../../lib/cx.js";

/* The long view: a three-photo collage beside one big sentence.

   The collage is three FRAMES, each a different cut of the same rounded
   language the rest of the site speaks:

     arch  — full rounding across the top, a soft 16px base. Reads as a
             doorway; it takes a portrait subject.
     drop  — a circle with one corner pulled square, pointing in at the
             badge. It takes a single face.
     wide  — the brand swoop (the big elliptical corner FightFor and
             FeatureBanner use), bottom-left here so the three shapes turn
             around the centre rather than all leaning one way.

   The badge sits where the three meet. It is absolutely placed INSIDE the
   collage's own relative box, so it tracks the photographs at every width
   instead of being positioned against the section.

   ⚠ Every radius here is either a token (rounded-2xl) or a shape
   (`rounded-t-full`, a percentage swoop). No fixed-rem swoop: on a phone a
   9rem corner eats half of a 170px-wide photograph. */

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
      className="h-4 w-4 transition-transform group-hover:translate-x-1"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Frame({ photo, className }) {
  return (
    <div className={cx("overflow-hidden bg-mist", className)}>
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        /* Per-photo focal point from content — an inline style because a
           class built from a variable is a class Tailwind never emits. */
        style={{ objectPosition: photo.focal }}
      />
    </div>
  );
}

export default function LegacyCollage({
  headline,
  headlineAccent,
  body,
  cta,
  secondary,
  badge,
  photos,
}) {
  return (
    <section className="bg-mist py-16 md:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[5fr_6fr] lg:gap-20">
        <div className="reveal relative grid grid-cols-2 gap-tiles">
          <Frame photo={photos.arch} className="aspect-[4/5] rounded-2xl rounded-t-full" />
          <Frame photo={photos.drop} className="aspect-[4/5] self-end rounded-full rounded-bl-2xl" />
          <Frame
            photo={photos.wide}
            className="col-span-2 aspect-[2/1] rounded-2xl rounded-bl-[45%_70%]"
          />

          {/* The badge. On the seam between the two top frames and the wide
              one, overlapping all three — the one element that ties the
              collage into a single object. A white ring separates it from
              whichever photograph is behind it. */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[55%] flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-trust-blue text-center text-paper-white shadow-sm ring-4 ring-mist md:h-32 md:w-32 md:ring-8"
          >
            <span className="text-[length:var(--text-heading-sm)] font-bold leading-none md:text-[length:var(--text-heading)]">
              {badge.value}
            </span>
            <span className="mt-1 max-w-[4rem] text-[11px] leading-tight tracking-caption text-paper-white/80 md:max-w-[6rem] md:text-[length:var(--text-caption)] md:leading-snug">
              {badge.label}
            </span>
          </div>
        </div>

        <div className="reveal">
          {/* The mark stands where the reference puts a heart: the brand's
              own sign of care, rather than a generic one. */}
          <Mark className="h-14 w-14 text-bumble-honey md:h-16 md:w-16" />

          <h2 className="mt-6 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading md:text-[length:clamp(2.5rem,3.6vw,3.25rem)] md:leading-[1.12]">
            {headline}{" "}
            <span className="text-bumble-honey">{headlineAccent}</span>
          </h2>

          <p className="mt-6 max-w-prose text-graphite">{body}</p>

          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Button to={cta.to}>{cta.label}</Button>
            {secondary && (
              <Button variant="link" to={secondary.to} className="group gap-2 no-underline hover:underline">
                {secondary.label}
                <ArrowIcon />
              </Button>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
