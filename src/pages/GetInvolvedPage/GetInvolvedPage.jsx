import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import QuestionsPanel from "../../components/QuestionsPanel/QuestionsPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import {
  GET_INVOLVED,
  GET_INVOLVED_PAGES,
  IMPACT_PAGES,
  WORK,
  pathCards,
} from "../../content/index.js";

/* /get-involved — the gateway to the four ways to take part (Document 06):

     01  mist band  PageHeader        the invitation
     02  white      InvolvementPaths  the four paths, as cards
     03  white      ProgramIndex      each path, a line on it, a link
     04  white      ContentRows       why get involved — the mission
     05  white      TeaserPair        Our Work · Our Impact
     06  white      QuestionsPanel    the contact route, or its pending state
     07  mist band  ClosingCta        the next step

   The paths come from content/getInvolved.js, the same records the nav,
   the homepage and each path's page read. "Why get involved" is the
   mission as the annual report states it — the one approved statement of
   purpose — rather than claims about outcomes, scale or urgency. */
export default function GetInvolvedPage() {
  useReveal();
  const t = GET_INVOLVED_PAGES.hub;
  const { paths, contact } = GET_INVOLVED;

  return (
    <>
      <PageHeader
        title={t.heading}
        kicker={t.kicker}
        aside={<IconPanel icons={paths.map((p) => p.icon)} className="reveal" />}
      >
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {t.body}
        </p>
      </PageHeader>

      <div className="pt-20 md:pt-28">
        <InvolvementPaths {...t.ways} items={pathCards()} />
      </div>

      <ProgramIndex
        {...t.choose}
        programs={paths.map((path) => ({
          title: path.title,
          description: path.shortDescription,
          note: t.choose.notes[path.id] ?? t.choose.pending,
          to: path.to,
          icon: path.icon,
          linkLabel: `${t.choose.linkPrefix} ${path.title}`,
        }))}
      />

      <ContentRows
        className="pt-0 md:pt-0"
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

      <QuestionsPanel {...t.questions} contact={contact} />

      <ClosingCta {...t.closing} />
    </>
  );
}
