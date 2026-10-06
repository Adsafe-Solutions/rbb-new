import { useId } from "react";
import Button from "../Button/Button.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import StepCard from "../StepCard/StepCard.jsx";

/* How the work is done — a band of Sky Blue with the statement set at
   billboard size, the line that expands on it, and the way on.

   `steps` render as numbered StepCards ONLY when they are given, and the
   content layer gives them only once RBB has approved the framework
   (content/impact.js `approachSteps`). Until then this is the statement,
   the line and the link — Listen → Partner → Act → Sustain is never
   presented as RBB's method because a layout had room for it.

   Sky Blue, so everything on it is Night (the `accent` tone): Deep Trust
   Blue type on this blue is 3.89:1, and the tone makes that impossible to
   get wrong. The mark stamp is the band's one object when there are no
   steps. `id` is the section's anchor. */
export default function ApproachFlow({ id, index, kicker, heading, intro, steps = [], cta, tone = "accent" }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" watermark="right" aria-labelledby={headingId}>
      <div className="grid gap-12 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-20">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} size="billboard" />
        <div data-anim="sequence" className="relative">
          {/* Wrapped: the stamp's tilt is a `rotate`, and on the element
              the motion system reveals GSAP would fold it away. */}
          <div data-anim-item className="mb-8">
            <MarkStamp className="h-20 w-20 -rotate-6 md:h-24 md:w-24" front="text-night" back="text-paper-white" />
          </div>
          {intro && (
            <p data-anim-item data-anim="soft" className="type-lead max-w-[42ch]">
              {intro}
            </p>
          )}
          {cta && (
            <div data-anim-item data-anim="soft" className="mt-8">
              <Button variant="ink" to={cta.to}>
                {cta.label}
              </Button>
            </div>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <ol data-anim-stagger className="mt-16 grid gap-cards sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title}>
              <StepCard number={i + 1} title={step.title} className="h-full">
                {step.body && <p className="text-quiet">{step.body}</p>}
              </StepCard>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
