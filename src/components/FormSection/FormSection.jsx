import { useId } from "react";
import Container from "../Container/Container.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { formState } from "../../lib/forms.js";

/* A form as a section of its own — the Volunteer, Partner and Fundraise
   inquiries (Document 12). Renders NOTHING while its form is disabled:
   those pages already say, in their "Get in touch" panel, that the route
   is still to come, and an empty heading here would read as a step
   someone could take. */
export default function FormSection({ id, kicker, config, alternative }) {
  const headingId = useId();
  if (formState(config) !== "ready") return null;

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <SectionHeading id={headingId} kicker={kicker} heading={config.heading} intro={config.intro} />
        <FormShell config={config} alternative={alternative} className="max-w-2xl" />
      </Container>
    </section>
  );
}
