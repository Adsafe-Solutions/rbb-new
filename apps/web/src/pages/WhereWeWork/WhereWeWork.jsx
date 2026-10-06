import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import OffsetCard from "../../components/OffsetCard/OffsetCard.jsx";
import Mark from "../../components/Mark/Mark.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { IMPACT, IMPACT_PAGES } from "../../content/index.js";

/* /impact/where-we-work — verified geography, or the honest empty state.

   Geography is TEXT first: regions as headings, their countries as lists,
   then any stray countries in one list. A map can be added once verified
   geography exists, and this list stays beside it as its text
   equivalent — geography is never conveyed by position alone.

   ⚠ Until RBB supplies countries, there is no list, no map and no guess.
   The "25 countries reached" figure is never turned into names here. */
export default function WhereWeWork() {
  const headingId = useId();
  const t = IMPACT_PAGES.whereWeWork;
  const { geography } = IMPACT;
  const hasGeography = geography.regions.length > 0 || geography.countries.length > 0;

  return (
    <>
      <PageHeader title={t.heading} parent={{ label: "Our Impact", to: "/impact" }} kicker={t.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {geography.summary ?? t.body}
        </p>
      </PageHeader>

      {/* Geography as TEXT: each region a flyer, its countries listed on
          it. No map — not until RBB's verified geography exists, and then
          this list stays beside it as its text equivalent. */}
      {/* No section at all until RBB's verified geography exists — no
          placeholder regions, no "to be provided" (content brief,
          2026-10-04). The header's general line stands alone. */}
      {hasGeography && (
      <Section tone="white" pad="lg" aria-labelledby={headingId}>
        <SectionHeading id={headingId} index={1} heading={t.listHeading} />

        {hasGeography && (
          <ul data-anim-stagger className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {geography.regions.map((region) => (
              <li key={region.name}>
                <OffsetCard className="h-full">
                  <Mark className="h-8 w-8 text-pop" />
                  <h3 className="type-card mt-5">{region.name}</h3>
                  <ul className="mt-5 grid gap-2 border-t-2 border-dashed border-hair pt-5 text-copy">
                    {region.countries.map((country) => (
                      <li key={country}>{country}</li>
                    ))}
                  </ul>
                </OffsetCard>
              </li>
            ))}
            {geography.countries.length > 0 && (
              <li>
                <OffsetCard className="h-full">
                  <ul className="grid gap-2 text-copy">
                    {geography.countries.map((country) => (
                      <li key={country}>{country}</li>
                    ))}
                  </ul>
                </OffsetCard>
              </li>
            )}
          </ul>
        )}
      </Section>
      )}

      <ClosingCta {...t.closing} />
    </>
  );
}
