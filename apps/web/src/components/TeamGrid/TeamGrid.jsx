import { useId } from "react";
import Button from "../Button/Button.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import TeamCard from "../TeamCard/TeamCard.jsx";

/* The people behind the organisation, as a row of portrait prints
   (TeamCard) — every portrait the same 4:5 crop in the same frame, square
   to the page, so a team reads as a set whatever photographs arrive.

   Members are { name, role, bio?, image?, to? } and come straight from
   content; a member with `to` is a link to their profile. With no members
   the section shows `fallback` beside three empty frames — the shape a
   team row will take, plainly empty. Nobody is invented to fill it. */
export default function TeamGrid({ id, index, kicker, heading, members, fallback, cta, tone = "white" }) {
  const headingId = useId();
  const empty = members.length === 0;

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
        {cta && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>

      {empty ? (
        <div className="reveal mt-14 grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <p className="type-lead max-w-md rounded-xl border-2 border-dashed border-hair px-5 py-4 text-quiet">{fallback}</p>
          <div aria-hidden="true" className="grid grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <OffsetCard key={i} pad="none" className="overflow-hidden p-2">
                <MediaPlaceholder className="aspect-[4/5] rounded-lg" />
              </OffsetCard>
            ))}
          </div>
        </div>
      ) : (
        <ul data-anim-stagger className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 md:mt-16 lg:grid-cols-3 xl:grid-cols-4">
          {members.map((member) => (
            <li key={member.name}>
              <TeamCard name={member.name} role={member.role} image={member.image} to={member.to} sample={member.sample} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
