import { useId } from "react";
import Section from "../Section/Section.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { formState } from "../../lib/forms.js";

/* A form as a section of its own — the Volunteer, Partner and Fundraise
   inquiries (Document 12). Renders NOTHING while its form is disabled:
   those pages already say, in their "Get in touch" panel, that the route
   is still to come, and an empty heading here would read as a step
   someone could take. */
export default function FormSection({ id, kicker, config, alternative, tone = "paper", highlight }) {
  const headingId = useId();
  if (formState(config) !== "ready") return null;

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          <SectionHeading id={headingId} kicker={kicker} heading={config.heading} intro={config.intro} highlight={highlight} />
        </div>
        <FormShell config={config} alternative={alternative} className="max-w-2xl" />
      </div>
    </Section>
  );
}
