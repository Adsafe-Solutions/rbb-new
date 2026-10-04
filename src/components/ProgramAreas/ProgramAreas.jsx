import { useId } from "react";
import { FlyerLinkCard } from "../FlyerCard/FlyerCard.jsx";
import Marquee from "../Marquee/Marquee.jsx";
import { tiltAt } from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The four program areas as four flyers pinned up on a Deep Trust Blue
   wall, each leaning its own way — then the program names running along
   the bottom of the band.

   Each flyer is one link (FlyerLinkCard): its title, stretched over the
   card, with "Explore" added for assistive tech — so a screen reader
   lists four destinations, not four "Learn more"s.

   The flyers are offset in a staggered 2 × 2 from `md` (the second
   column sits lower — by MARGIN: a `translate` utility on an element the
   motion system reveals is folded into GSAP's transform and lost), which is what makes this a wall of paper rather
   than a table of four equal cells.

   Icons, not photographs: the only photographs RBB has supplied are of
   relief distributions, and a picture of one under "Education" would
   claim an education project nobody has described. */
export default function ProgramAreas({ index, kicker, heading, items, tone = "ink", highlight }) {
  const headingId = useId();

  return (
    <Section tone={tone} pad="none" aria-labelledby={headingId} bare>
      <div className="relative mx-auto w-full max-w-[var(--page-max-width)] px-5 pt-20 md:px-8 md:pt-32">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />

        <ul data-anim-stagger className="mt-14 grid gap-x-8 gap-y-10 md:mt-16 md:grid-cols-2 md:gap-x-10 md:gap-y-12">
          {items.map((item, i) => (
            <li key={item.to} className={i % 2 === 1 ? "md:mt-14" : "md:mb-14"}>
              <FlyerLinkCard
                tilt={tiltAt(i)}
                icon={item.icon}
                meta={String(i + 1).padStart(2, "0")}
                title={item.title}
                to={item.to}
                label="Explore"
              >
                {item.description}
              </FlyerLinkCard>
            </li>
          ))}
        </ul>
      </div>

      <Marquee items={items.map((item) => item.title)} className="mt-20 border-t-2 border-hair md:mt-36" />
    </Section>
  );
}
