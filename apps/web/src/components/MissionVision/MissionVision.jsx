import { useId } from "react";
import PosterCard from "../PosterCard/PosterCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Mission and vision as two posters — the mission on Deep Trust Blue,
   the vision on Sky Blue, the second pasted a little lower and leaning
   the other way. Mission first in both orders, because a mission is what
   you do and a vision is where it leads; Document 03 is explicit that
   the two stay distinct, never one paragraph or one card.

   Each statement is set at display size — this is the one section of the
   page meant to be read twice. `source` says where the words come from. */
export default function MissionVision({ id, index, kicker, heading, mission, vision, source, tone = "paper" }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />

      <div className="mt-14 grid gap-12 md:mt-16 lg:grid-cols-2 lg:gap-10">
        {[
          { ...mission, tone: "ink", tilt: "l" },
          { ...vision, tone: "accent", tilt: "r" },
        ].map((item, i) => (
          <div key={item.label} className={i === 1 ? "reveal lg:mt-20" : "reveal"}>
            <PosterCard tone={item.tone} tilt={item.tilt}>
              <h3 className="type-meta text-fg">{item.label}</h3>
              <p className="mt-6 text-[clamp(1.5rem,2.6vw,2.25rem)] font-extrabold leading-[1.18] tracking-tight text-fg">
                {item.statement}
              </p>
            </PosterCard>
          </div>
        ))}
      </div>

      {source && <p className="type-note reveal mt-12 text-quiet">{source}</p>}
    </Section>
  );
}
