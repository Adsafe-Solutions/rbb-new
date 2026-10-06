import { useId } from "react";
import { cx } from "../../lib/cx.js";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FlyerCard from "../FlyerCard/FlyerCard.jsx";
import { tiltAt } from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An organisation's values as a numbered set of flyers — the number
   stamped on the accent in each corner, the value in display type.
   Items are { title, description? } and come straight from content.

   With no items it shows `fallback` on a pinned-up sheet: the section
   keeps its place and its heading, and says plainly that the values are
   still to come. It never fills the gap with generic ones. */
export default function ValuesList({ id, index, kicker, heading, items, fallback, tone = "ink", highlight }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" watermark="right" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />

      {items.length > 0 ? (
        <ol data-anim-stagger className="mt-14 grid gap-x-8 gap-y-10 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
          {items.map((value, i) => (
            <li key={value.title} className={cx(i % 3 === 1 && "lg:mt-10")}>
              <FlyerCard as="div" number={i + 1} title={value.title} tilt={tiltAt(i)}>
                {value.description}
              </FlyerCard>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyPanel text={fallback} className="reveal mt-14" />
      )}
    </Section>
  );
}
