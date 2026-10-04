import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { ABOUT, IMPACT, IMPACT_PAGES } from "../../content/index.js";

/* /impact/our-approach — how RBB works towards sustainable growth and
   lasting change.

   Built on the one thing the supplied material does say: the mission,
   quoted as it stands (read from content/about.js, not copied). The
   detailed approach and any principles are placeholders until RBB
   supplies them.

   ⚠ The Listen → Partner → Act → Sustain steps are NOT on this page.
   They are a structure Document 02 proposed for the homepage; here, on
   the page titled "Our Approach", they would read as RBB's official
   method, which Document 05 forbids until RBB approves it. They are kept
   in content/impact.js (approach.proposedFramework) for that day. */
export default function Approach() {
  const t = IMPACT_PAGES.approach;
  const { approach } = IMPACT;

  return (
    <>
      <PageHeader title={t.heading} parent={{ label: "Our Impact", to: "/impact" }} kicker={t.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {t.body}
        </p>
      </PageHeader>

      <ContentRows
        rows={[
          {
            id: "foundation",
            heading: t.foundationLabel,
            body: ABOUT.missionVision.mission.statement,
          },
          {
            id: "how-we-work",
            heading: t.how.heading,
            body: approach.intro ?? undefined,
            empty: t.how.empty,
          },
          {
            id: "principles",
            heading: t.principles.heading,
            items: approach.principles,
            empty: t.principles.empty,
          },
        ]}
      />

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
