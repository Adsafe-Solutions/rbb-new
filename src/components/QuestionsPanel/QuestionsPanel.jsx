import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* "Questions? Get in touch" — the contact step at the end of the Get
   Involved pages.

   `contact` is the approved route ({ label, url, pending }). With a `url`
   it is one clear button; without, the pending line stands in its place,
   with `cta` (the Contact page) as the way on. Never a form: a form with
   nowhere real to send its message would look like it reached RBB and
   reach nobody. `intro` is an optional line under the heading saying what
   the route is for.

   `form` (Document 12) is a form config. Once it is ready it is the
   route, in place of the button or pending line; while it is disabled
   nothing about this panel changes. `alternative` is a verified contact
   route to offer if a submission fails. */
export default function QuestionsPanel({ kicker, heading, intro, contact, cta, form, alternative }) {
  const headingId = useId();
  const route = contact.url ? (
    <Button href={contact.url} className="reveal mt-10">
      {contact.label}
    </Button>
  ) : (
    <EmptyPanel text={contact.pending} cta={cta} className="reveal mt-10" />
  );

  return (
    <section aria-labelledby={headingId} className="py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} intro={intro} className="reveal" />
        {form ? (
          <FormShell config={form} fallback={route} alternative={alternative} className="mt-10 max-w-2xl" />
        ) : (
          route
        )}
      </Container>
    </section>
  );
}
