import { useId } from "react";
import Container from "../Container/Container.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An editorial two-column statement: the heading large on the left, the
   paragraphs that expand on it on the right — the layout of a feature
   opening rather than a card. No picture: this is where the page says
   something in words, and it has the room to.

   `id` is the section's anchor (the nav's "Who We Are" lands here);
   `scroll-mt` keeps the fixed header off its heading when it does. */
export default function StatementSplit({ id, kicker, heading, body }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] py-20 md:py-28">
      <Container className="grid gap-8 lg:grid-cols-[7fr_5fr] lg:gap-20">
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />
        <div className="reveal lg:pt-12">
          {body.map((text) => (
            <p
              key={text}
              className="mt-5 text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite first:mt-0 first:text-bumble-ink"
            >
              {text}
            </p>
          ))}
        </div>
      </Container>
    </section>
  );
}
