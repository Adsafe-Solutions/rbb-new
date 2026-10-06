import { useId } from "react";
import Button from "../Button/Button.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import StatCard from "../StatCard/StatCard.jsx";
import { SITE } from "../../content/index.js";

/* The headline figures, made the loudest thing on the page: each number
   in the poster scale on a block of the accent, on a card of its own.

   Asymmetric from `lg`: the heading, the source and the verification
   note in a narrow column, the figures beside it — the first across the
   full width as the headline figure, on its own ink, the rest in a row
   under it. A row of three equal boxes would be a dashboard; this is a
   poster with a lead.

   For RBB's own figures (Documents 02, 05):
     body    an optional qualitative line under the heading — words, never
             a figure
     stats   { value, label, status } from content/impact.js — nothing is
             added to them, and nothing counts up unless RBB has
             confirmed it (StatCard)
     note    the verification sentence, shown whenever any figure is still
             pending, in words, never dropped
     source  where the figures come from
     cta     a way on
     id      the jump target (/impact#at-a-glance)

   Each card also carries its own status stamp, so a figure seen alone —
   a screenshot, a share — still says it is pending. */
export default function ImpactStats({ id, index, kicker, heading, body, stats, note, source, cta, tone = "ink", branded, surface, highlight }) {
  const headingId = useId();
  const [lead, ...rest] = stats;

  return (
    <Section id={id} tone={tone} pad="lg" watermark="left" aria-labelledby={heading ? headingId : undefined}>
      <div className="grid gap-14 lg:grid-cols-[4fr_8fr] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          {heading && <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />}
          {body && <p className="type-lead reveal mt-6 max-w-[40ch] text-copy">{body}</p>}
          {(source || note) && (
            <div className="reveal mt-8 max-w-[40ch] border-l-4 border-pop pl-5">
              {source && <p className="type-note text-fg">{source}</p>}
              {note && <p className="mt-2 text-copy">{note}</p>}
            </div>
          )}
          {cta && (
            <Button data-anim="soft" variant="ink" to={cta.to} className="mt-9">
              {cta.label}
            </Button>
          )}
        </div>

        <ul data-anim-stagger className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {lead && (
            <li className="sm:col-span-2">
              <StatCard {...lead} tone="accent" tilt="l" pending={SITE.figurePending} />
            </li>
          )}
          {rest.map((stat) => (
            <li key={stat.label}>
              <StatCard {...stat} pending={SITE.figurePending} />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
