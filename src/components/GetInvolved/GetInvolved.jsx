import { useId } from "react";
import { cx } from "../../lib/cx.js";
import ActionCard, { actionTone } from "../ActionCard/ActionCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The ways to take part as a row of action boxes — one family in four
   inks (ActionCard): the first, the primary ask, on Sky Blue; the others
   on Deep Trust Blue and white paper.

   `items` are the paths from content/getInvolved.js `pathCards()` — their
   own names, approved one-line descriptions and links, in the approved
   order. Nothing else is claimed about any path. The headline sits at
   billboard size, because this is the section the whole page has been
   building to. */
export default function GetInvolved({ id, index, kicker, heading, items, tone = "white", size = "billboard", highlight }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} size={size} />

      <ul data-anim-stagger className={cx("mt-14 grid gap-8 sm:grid-cols-2 md:mt-16 lg:gap-6", items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {items.map((item, i) => (
          <li key={item.to}>
            <ActionCard
              tone={actionTone(i)}
              icon={item.icon}
              title={item.title}
              body={item.description}
              to={item.to}
              label={item.cta}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
