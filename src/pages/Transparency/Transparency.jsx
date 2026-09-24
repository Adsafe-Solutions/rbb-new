import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import FinancialOverview from "../../components/FinancialOverview/FinancialOverview.jsx";
import DocumentList from "../../components/DocumentList/DocumentList.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import {
  IMPACT_PAGES,
  TRANSPARENCY,
  TRANSPARENCY_COPY,
  publishedDocuments,
} from "../../content/index.js";

/* /about/transparency — Document 09, in its section order:

     01  mist band  PageHeader         what is here, with jump links
     02  white      FinancialOverview  the 2026 shares — text first, bar on top
     03  mist band  DocumentList       annual reports (#annual-reports)
     04  white      DocumentList       financial information (#financial-information)
     05  mist band  DocumentList       governance (#governance)
     06  white      ContentRows        how information is presented
     07+08 white    TeaserPair         Our Impact · Get Involved
     09  mist band  ClosingCta         About Us · Contact

   Everything comes from content/transparency.js. The panels elsewhere on
   the site ("Annual Reports", "Financial Information", "Governance") link
   straight to sections 03–05 here.

   ⚠ No registration, audit, tax, legal-status, certification or
   compliance wording, no seals or badges, no amounts, and no document
   without a real approved file. */
export default function Transparency() {
  useReveal();
  const t = TRANSPARENCY_COPY;
  const { financialOverview, governance, accountability } = TRANSPARENCY;

  /* Jump links to the four main sections, named as a reader would look
     for them. */
  const jump = [
    { title: t.overview.kicker, to: `#${t.overview.id}` },
    { title: t.reports.heading, to: `#${t.reports.id}` },
    { title: t.financial.heading, to: `#${t.financial.id}` },
    { title: t.governance.heading, to: `#${t.governance.id}` },
  ];

  return (
    <>
      <PageHeader title={t.heading} parent={{ label: "About Us", to: "/about" }} kicker={t.kicker}>
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {t.body}
        </p>
        <nav aria-label={t.onThisPage} className="mt-8">
          <LinkChips items={jump} align="start" />
        </nav>
      </PageHeader>

      <FinancialOverview
        {...t.overview}
        items={financialOverview.items}
        note={financialOverview.status === "verified" ? undefined : t.overview.verification}
      />

      <DocumentList
        {...t.reports}
        documents={publishedDocuments(TRANSPARENCY.annualReports)}
        surface="mist"
      />

      <DocumentList {...t.financial} documents={publishedDocuments(TRANSPARENCY.financialDocuments)} />

      <DocumentList
        {...t.governance}
        documents={publishedDocuments(governance.documents)}
        empty={governance.intro || governance.sections.length ? undefined : t.governance.empty}
        surface="mist"
      >
        {(governance.intro || governance.sections.length > 0) && (
          <div className="reveal mt-6 max-w-prose">
            {governance.intro && <p className="text-graphite">{governance.intro}</p>}
            {governance.sections.map((s) => (
              <div key={s.heading} className="mt-6">
                <h3 className="font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                  {s.heading}
                </h3>
                <p className="mt-2 text-graphite">{s.body}</p>
              </div>
            ))}
          </div>
        )}
      </DocumentList>

      <ContentRows
        rows={[{ id: t.accountability.id, heading: t.accountability.heading, body: accountability.intro }]}
      />

      <TeaserPair
        first={{ ...t.related.impact, body: IMPACT_PAGES.overview.body }}
        second={t.related.involve}
      />

      <ClosingCta {...t.closing} />
    </>
  );
}
