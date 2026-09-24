import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Headline figures, set large on the Deep Trust Blue band — numbers as
   typography, not tiles. A <dl>: each figure is a value for a term, and
   that is how a screen reader should hear it ("Countries Reached, 25").
   The value is drawn above its label with flex order, so the visual and
   the spoken order can each be the natural one.

   `source` is shown under the figures: it says where they come from, in
   words, rather than leaving the numbers to stand as unattributed claims.
   Nothing here is animated beyond the section reveal — a count-up would
   render "0" first, and a number that is wrong for a second is still
   wrong.

   `note` is the figures' verification status in words ("pending final
   verification", Document 19) — shown with the source, never implied by
   styling alone. */
/* `id` is the section's anchor (the nav's "Impact at a Glance" lands on it
   on /impact). A metric's optional `description` sits under its label. */
export default function ImpactMetrics({ id, kicker, heading, metrics, source, note, cta }) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="relative scroll-mt-[var(--header-h)] overflow-hidden bg-trust-blue py-20 text-paper-white md:py-28"
    >
      {/* Sized inline: Mark's default `h-8 w-8` would otherwise race a
          second size utility on the same element. */}
      <Mark
        className="pointer-events-none absolute -right-24 -top-24 hidden text-paper-white/[0.05] md:block"
        style={{ width: "28rem", height: "28rem" }}
      />

      <Container className="relative">
        <SectionHeading
          id={headingId}
          kicker={kicker}
          heading={heading}
          tone="invert"
          className="reveal"
        />

        <dl className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-0 md:mt-16">
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              style={{ transitionDelay: `${i * 110}ms` }}
              className="reveal flex flex-col-reverse border-t border-paper-white/20 pt-6 sm:border-l sm:border-t-0 sm:px-8 sm:pt-0 sm:first:border-l-0 sm:first:pl-0"
            >
              <dt className="mt-3 max-w-[16rem] text-[length:var(--text-body)] leading-body text-paper-white/85">
                {metric.label}
                {metric.description && (
                  <span className="mt-2 block text-[length:var(--text-caption)] leading-caption text-paper-white/75">
                    {metric.description}
                  </span>
                )}
              </dt>
              <dd className="font-bold leading-none tracking-heading-lg text-[length:clamp(3.25rem,7vw,5.5rem)] text-paper-white">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="reveal mt-14 flex flex-col gap-6 border-t border-paper-white/20 pt-8 sm:flex-row sm:items-center sm:justify-between">
          {(source || note) && (
            <p className="text-[length:var(--text-caption)] leading-caption tracking-caption text-paper-white/75">
              {source}
              {/* A real space: `block` breaks the line visually, but the
                  two are read as one run of text. */}
              {source && note && " "}
              {note && <span className="mt-1 block font-medium text-paper-white">{note}</span>}
            </p>
          )}
          {cta && (
            <Button variant="inverse" to={cta.to} className="self-start sm:self-auto">
              {cta.label}
            </Button>
          )}
        </div>
      </Container>
    </section>
  );
}
