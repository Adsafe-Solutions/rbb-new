import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Section from "../../components/Section/Section.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import OffsetCard from "../../components/OffsetCard/OffsetCard.jsx";
import LineIcon from "../../components/LineIcon/LineIcon.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { HOW_WE_WORK } from "../../content/index.js";

/* /about/how-we-work — how the work is run day to day (content/about.js
   HOW_WE_WORK, a working placeholder):

         paper   PageHeader   the line, the practices' icon cluster
     01  ink     In practice  four practices as cards
         white   ContentRows  02–05: from idea to project, people,
                              feedback, accountability
         paper   TeaserPair   Our Approach · Transparency
         accent  ClosingCta

   The approach and principles stay on /impact/our-approach; this page
   links there rather than repeating them. */
export default function HowWeWork() {
  const t = HOW_WE_WORK;
  const practicesId = useId();

  return (
    <>
      <PageHeader
        title={t.heading}
        kicker={t.kicker}
        parent={{ label: "About Us", to: "/about" }}
        aside={<IconPanel icons={t.practices.items.map((p) => p.icon)} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{t.body}</p>
      </PageHeader>

      <Section tone="ink" pad="lg" watermark="right" aria-labelledby={practicesId}>
        <SectionHeading id={practicesId} index={1} kicker={t.practices.kicker} heading={t.practices.heading} />
        {/* Read and compared, so square: no tilt. */}
        <ul data-anim-stagger className="gap-cards mt-14 grid sm:grid-cols-2 lg:grid-cols-4">
          {t.practices.items.map((item) => (
            <li key={item.title}>
              <OffsetCard pad="md" className="h-full">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-pop text-on-pop">
                  <LineIcon name={item.icon} className="h-6 w-6" />
                </span>
                <h3 className="type-card mt-6">{item.title}</h3>
                <p className="mt-3 text-copy">{item.description}</p>
              </OffsetCard>
            </li>
          ))}
        </ul>
      </Section>

      <ContentRows start={2} rows={t.rows} />

      <TeaserPair first={t.related.approach} second={t.related.transparency} />

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
