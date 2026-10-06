import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import QuestionsPanel from "../../components/QuestionsPanel/QuestionsPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import {
  GET_INVOLVED,
  GET_INVOLVED_PAGES,
  IMPACT_PAGES,
  WORK,
  pathCards,
} from "../../content/index.js";

/* /get-involved — the gateway to the four ways to take part (Document 06):

         paper   PageHeader        the invitation, the paths' icon cluster
     01  white   GetInvolved       the four paths, as action boxes — billboard
     02  ink     ProgramIndex      each path, a line on it, a link
     03  white   ContentRows       why get involved — the mission
     —   paper   TeaserPair        Our Work · Our Impact
     04  white   QuestionsPanel    the contact route, or its pending state
         accent  ClosingCta        the next step

   The paths come from content/getInvolved.js, the same records the nav,
   the homepage and each path's page read. "Why get involved" is the
   mission as the annual report states it — the one approved statement of
   purpose — rather than claims about outcomes, scale or urgency. */
export default function GetInvolvedPage() {
  const t = GET_INVOLVED_PAGES.hub;
  const { paths, contact } = GET_INVOLVED;

  return (
    <>
      <PageHeader
        title={t.heading}
        kicker={t.kicker}
        aside={<IconPanel icons={paths.map((p) => p.icon)} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {t.body}
        </p>
      </PageHeader>

      <GetInvolved index={1} {...t.ways} items={pathCards()} highlight="take part" />

      <ProgramIndex
        index={2}
        tone="ink"
        {...t.choose}
        programs={paths.map((path) => ({
          title: path.title,
          /* The longer line only: the card row above already gave the
             short one. */
          description: t.choose.notes[path.id] ?? t.choose.pending,
          to: path.to,
          icon: path.icon,
          linkLabel: `${t.choose.linkPrefix} ${path.title}`,
        }))}
      />

      <ContentRows
        start={3}
        rows={[
          {
            id: "why",
            heading: t.why.heading,
            body: t.why.body,
          },
        ]}
      />

      <TeaserPair
        first={{ ...t.related.work, body: WORK.overview.body }}
        second={{ ...t.related.impact, body: IMPACT_PAGES.overview.body }}
      />

      <QuestionsPanel index={4} tone="white" {...t.questions} contact={contact} />

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
