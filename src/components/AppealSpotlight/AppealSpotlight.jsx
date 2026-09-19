import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import { cx } from "../../lib/cx.js";

/* One live appeal, whole: what we are doing, what it has done, and how to
   help — in a single card rather than spread over two bands.

     photograph  │  status · kicker · heading · body · partners
                 │  four figures (the first one inverted)
                 │  donate · read the report

   The photograph carries the brand's swoop on the corner where it meets
   the copy, as FeatureBanner does, so this reads as part of the same
   family rather than a new idiom. On lg it fills the card's full height:
   the <img> is absolutely placed, so the COPY sets the height and the
   picture follows. An in-flow image would bring its own aspect ratio into
   the row and the card would grow to suit the photograph.

   The figures are a <dl>: each is a value and the thing it counts. The
   first is filled Deep Trust Blue — one emphasis, the number the appeal is
   really about — and the others sit on Mist. Values are the number alone;
   the unit is in the label (see content/ngo.js for why). */

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

export default function AppealSpotlight({
  status,
  kicker,
  heading,
  body,
  partners,
  stats,
  ctas,
  src,
  alt,
}) {
  return (
    /* Tighter than a full section: this sits straight after the hero as a
       compact "what is happening now", not as a chapter of its own. */
    <section className="py-12 md:py-16">
      <Container>
        <div className="reveal grid overflow-hidden rounded-3xl bg-paper-white shadow-sm lg:grid-cols-[4fr_7fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-br-[4rem] lg:aspect-auto lg:rounded-br-none lg:rounded-tr-[6rem]">
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover lg:absolute lg:inset-0"
            />
            {/* The status pill. A live appeal and a finished one look
                identical otherwise, and "is this still happening?" is the
                first thing someone deciding whether to give wants to know. */}
            <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-paper-white/90 px-4 py-2 text-[length:var(--text-caption)] font-medium tracking-caption text-trust-blue shadow-sm backdrop-blur-sm">
              {/* The dot pulses, gently: it is the one thing on the card
                  that says "now". `motion-reduce` keeps it as a still dot. */}
              <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-growth-green opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-growth-green" />
              </span>
              {status}
            </span>
          </div>

          <div className="p-8 md:p-10 lg:p-12">
            <p className="text-[length:var(--text-caption)] font-medium uppercase tracking-[0.18em] text-bumble-honey">
              {kicker}
            </p>
            <h2 className="mt-3 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
              {heading}
            </h2>
            <p className="mt-4 max-w-prose text-graphite">{body}</p>

            {partners && (
              <p className="mt-5 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                <span className="font-medium text-bumble-ink">{partners.label}</span>{" "}
                {partners.names.join(" · ")}
              </p>
            )}

            {/* Three columns from `sm` only. At phone width a third of the card
                is about 60px, and "225,610" set as a heading clips to
                "225,6". Below sm each figure is a row instead — number
                left, label beside it — which costs a little height and
                loses nothing. */}
            <dl className="mt-7 grid gap-2 sm:grid-cols-3 sm:gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={cx(
                    "flex flex-row-reverse items-baseline justify-end gap-3 rounded-2xl px-5 py-3.5",
                    "sm:flex-col-reverse sm:items-start sm:gap-0 sm:p-5",
                    stat.highlight ? "bg-trust-blue text-paper-white" : "bg-mist"
                  )}
                >
                  {/* <dt> comes first in the markup, so a screen reader
                      hears "People reached, 225,610" — label, then value.
                      The -reverse directions flip only the PAINTED order,
                      so the eye gets the number first: to its left on a
                      phone, above it from sm up. */}
                  <dt
                    className={cx(
                      "text-[length:var(--text-caption)] leading-caption tracking-caption sm:mt-1",
                      stat.highlight ? "text-paper-white/80" : "text-graphite"
                    )}
                  >
                    {stat.label}
                  </dt>
                  <dd
                    className={cx(
                      "font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm",
                      stat.highlight ? "text-paper-white" : "text-trust-blue"
                    )}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button href={ctas.primary.href} to={ctas.primary.to} className="gap-3">
                {ctas.primary.label}
                <ArrowIcon />
              </Button>
              <Button variant="outline" to={ctas.secondary.to}>
                {ctas.secondary.label}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
