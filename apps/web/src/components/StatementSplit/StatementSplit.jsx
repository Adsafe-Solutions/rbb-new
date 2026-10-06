import { useId } from "react";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An editorial two-column statement: the heading set large on the left,
   the paragraphs that expand on it on the right, the first of them as a
   pull-quote — Sky Blue rule, display weight. The layout of a feature
   opening. No picture: this is where the page says something in words.

   `id` is the section's anchor (the nav's "Who We Are" lands here). */
export default function StatementSplit({ id, index, kicker, heading, body, tone = "white", highlight }) {
  const headingId = useId();
  const [first, ...rest] = body;

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="grid gap-12 lg:grid-cols-[6fr_5fr] lg:gap-20">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} size="billboard" />
        <div data-anim="sequence" className="lg:pt-12">
          {first && (
            <p data-anim-item data-anim="soft" className="border-l-[6px] border-pop pl-6 text-[clamp(1.375rem,2.2vw,1.75rem)] font-bold leading-snug text-fg">
              {first}
            </p>
          )}
          {rest.map((text) => (
            <p key={text} data-anim-item data-anim="soft" className="mt-6 max-w-[58ch] text-[19px] leading-relaxed text-copy">
              {text}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}
