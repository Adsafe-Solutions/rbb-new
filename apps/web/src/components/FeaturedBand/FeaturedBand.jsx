import { useId } from "react";
import Button from "../Button/Button.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A band of chosen records — the homepage's featured posts and events
   (pages/Home/CmsHome) — in the Media Center's own band layout: the
   numbered heading, the way on to all of them beside it, the cards below. */
export default function FeaturedBand({ index, tone, kicker, heading, highlight, cta, children }) {
  const headingId = useId();
  return (
    <Section tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
        {cta && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>
      {children}
    </Section>
  );
}
