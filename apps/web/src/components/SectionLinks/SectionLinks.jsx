import { Link } from "react-router-dom";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";

/* The pages inside a section, as a row of small printed tabs — what a
   section's own page offers below its intro.

   Text only, on purpose. The cards are read from the navigation config,
   which carries a label and a URL and nothing else; a photograph or a
   one-line summary per page would have to be written, and until RBB
   supplies that copy there is nothing true to put there.

   Each tab is one link, stretched; the arrow stamp turns on hover. */
export default function SectionLinks({ heading, items, tone = "paper", className = "" }) {
  return (
    <Section tone={tone} pad="md" className={className}>
      <h2 className="type-card">{heading}</h2>
      <ul data-anim-stagger className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.to}>
            <OffsetCard lift cast="sm" pad="sm" className="group flex h-full items-center justify-between gap-4">
              <Link to={item.to} className="type-card after:absolute after:inset-0 after:rounded-2xl">
                {item.label}
              </Link>
              <ArrowStamp />
            </OffsetCard>
          </li>
        ))}
      </ul>
    </Section>
  );
}
