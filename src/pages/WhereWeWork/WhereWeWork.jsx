import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import { IMPACT, IMPACT_PAGES } from "../../content/index.js";

/* /impact/where-we-work — verified geography, or the honest empty state.

   Geography is TEXT first: regions as headings, their countries as lists,
   then any stray countries in one list. A map can be added once verified
   geography exists, and this list stays beside it as its text
   equivalent — geography is never conveyed by position alone.

   ⚠ Until RBB supplies countries, there is no list, no map and no guess.
   The "25 countries reached" figure is never turned into names here. */
export default function WhereWeWork() {
  useReveal();
  const headingId = useId();
  const t = IMPACT_PAGES.whereWeWork;
  const { geography } = IMPACT;
  const hasGeography = geography.regions.length > 0 || geography.countries.length > 0;

  return (
    <>
      <PageHeader title={t.heading} parent={{ label: "Our Impact", to: "/impact" }} kicker={t.kicker}>
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {geography.summary ?? t.body}
        </p>
      </PageHeader>

      <section aria-labelledby={headingId} className="py-20 md:py-28">
        <Container>
          <SectionHeading id={headingId} heading={t.listHeading} className="reveal" />

          {hasGeography ? (
            <div className="reveal mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 md:mt-14">
              {geography.regions.map((region) => (
                <div key={region.name}>
                  <h3 className="border-t-2 border-bumble-honey pt-5 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                    {region.name}
                  </h3>
                  <ul className="mt-4 grid gap-2 text-graphite">
                    {region.countries.map((country) => (
                      <li key={country}>{country}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {geography.countries.length > 0 && (
                <ul className="grid gap-2 border-t-2 border-bumble-honey pt-5 text-graphite">
                  {geography.countries.map((country) => (
                    <li key={country}>{country}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <EmptyPanel
              text={t.empty}
              cta={t.emptyCta}
              className="reveal mt-12 md:mt-14"
            />
          )}
        </Container>
      </section>

      <ClosingCta {...t.closing} />
    </>
  );
}
