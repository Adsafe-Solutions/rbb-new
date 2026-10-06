import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* "Questions? Get in touch" — the contact step at the end of the Get
   Involved pages, and the general-inquiry route on /contact.

   `contact` is the approved route ({ label, url, pending }). With a `url`
   it is one clear button; without, the pending line stands in its place
   on a pinned-up sheet, with `cta` (the Contact page) as the way on.
   Never a form with nowhere real to send its message.

   `form` (Document 12) is a form config. Once it is ready it is the
   route — printed on a paper sheet, its fields numbered — in place of the
   button or pending line. `alternative` is a verified contact route to
   offer if a submission fails. */
export default function QuestionsPanel({ index, kicker, heading, intro, contact, cta, form, alternative, tone = "paper", highlight }) {
  const headingId = useId();
  const route = contact.url ? (
    <Button href={contact.url} size="lg" className="reveal mt-10">
      {contact.label}
    </Button>
  ) : contact.pending ? (
    <EmptyPanel text={contact.pending} cta={cta} className="reveal mt-10" />
  ) : cta ? (
    /* No route yet and nothing to announce: just the way on. */
    <Button to={cta.to} variant="outline" size="lg" className="reveal mt-10">
      {cta.label}
    </Button>
  ) : null;

  return (
    <Section tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className={form ? "grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16" : undefined}>
        <div className={form ? "lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start" : undefined}>
          <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} intro={intro} highlight={highlight} />
        </div>
        {form ? (
          <FormShell
            config={form}
            alternative={alternative}
            fallback={route}
            className="reveal"
          />
        ) : (
          route
        )}
      </div>
    </Section>
  );
}
