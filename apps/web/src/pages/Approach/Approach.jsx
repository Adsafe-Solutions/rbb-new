import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { IMPACT, IMPACT_PAGES } from "../../content/index.js";
import { missionStatement } from "../../content/about.js";

/* /impact/our-approach — how RBB works towards sustainable growth and
   lasting change.

   Built on the one thing the supplied material does say: the mission,
   quoted as it stands (read from content/about.js, not copied). The
   detailed approach and any principles are placeholders until RBB
   supplies them. Once the About page is published in the CMS, the mission
   is ITS Mission & Vision block's, so the two pages never disagree (#5);
   the intro and principles come from the Impact page's `approach` block
   (scripts/snapshot-adapter.mjs → IMPACT.approach).

   D11 (2026-10-13): the page reuses the existing approved content —
   the mission, and IMPACT.approach's intro and principles. The
   Listen → Partner → Act → Sustain framework was REJECTED by RBB: it is
   not RBB's method and must never appear here. */
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
            body: missionStatement(),
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
