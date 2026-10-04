import { useId } from "react";
import FinancialOverview from "../FinancialOverview/FinancialOverview.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import LinkChips from "../LinkChips/LinkChips.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { SITE, TRANSPARENCY, TRANSPARENCY_COPY, publishedDocuments } from "../../content/index.js";

/* Transparency & Financials, as one chapter of /about (#transparency).

   It used to be a page of its own; with the About section consolidated
   into two pages (About, Our Team) it is the last chapter of the About
   story, and /about/transparency forwards here. Two bands, read as one:

     ink    the chapter heading, the jump links, and the financial
            overview — the shares, each still stamped with its
            verification status
     white  the three kinds of document side by side (#annual-reports,
            #financial-information, #governance) and how the information
            is presented (#accountability)

   The anchors are the ones the old page had, so every "Annual Reports" /
   "Governance" link on the site lands on the right card.

   Everything comes from content/transparency.js. ⚠ No registration,
   audit, tax, legal-status or compliance wording, no amounts, and no
   document without a real approved file. */
function DocumentCard({ id, heading, documents, empty, children }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[calc(var(--header-h)+1rem)]">
      <OffsetCard className="flex h-full flex-col">
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-pop text-on-pop">
          <LineIcon name="document" className="h-5 w-5" />
        </span>
        <h3 id={headingId} className="type-card mt-5">
          {heading}
        </h3>
        {children}
        {documents.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {documents.map((doc) => {
              const meta = [doc.type, doc.year].filter(Boolean).join(" · ");
              return (
                <li key={doc.id}>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-fg underline decoration-2 underline-offset-4">
                    {doc.title}
                    {meta && <span className="sr-only"> ({meta})</span>}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  {meta && <span className="type-note mt-0.5 block font-medium text-quiet">{meta}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          empty && <p className="mt-4 rounded-xl border-2 border-dashed border-hair px-4 py-3 text-quiet">{empty}</p>
        )}
      </OffsetCard>
    </section>
  );
}

export default function TransparencySection({ index }) {
  const t = TRANSPARENCY_COPY;
  const { financialOverview, governance, accountability } = TRANSPARENCY;
  const headingId = useId();
  const hasGovernance = Boolean(governance.intro || governance.sections.length);

  const reports = publishedDocuments(TRANSPARENCY.annualReports);
  const financial = publishedDocuments(TRANSPARENCY.financialDocuments);
  const governanceDocs = publishedDocuments(governance.documents);
  /* Only what exists: a document area with nothing published is left
     out, with its jump link, rather than shown as an empty box. */
  const cards = [
    reports.length > 0 && "reports",
    financial.length > 0 && "financial",
    (hasGovernance || governanceDocs.length > 0) && "governance",
  ].filter(Boolean);

  const jump = [
    { title: t.overview.kicker, to: `#${t.overview.id}` },
    ...cards.map((c) => ({ title: t[c].heading, to: `#${t[c].id}` })),
    accountability.intro && { title: t.accountability.heading, to: `#${t.accountability.id}` },
  ].filter(Boolean);

  return (
    <>
      <Section id="transparency" tone="ink" pad="lg" watermark="right" aria-labelledby={headingId}>
        <SectionHeading id={headingId} index={index} kicker={t.kicker} heading={t.heading} intro={t.body} />
        <nav aria-label={t.onThisPage} className="reveal mt-8">
          <LinkChips items={jump} align="start" />
        </nav>
        <div className="mt-16 border-t-2 border-hair pt-12">
          <FinancialOverview
            embedded
            {...t.overview}
            items={financialOverview.items}
            note={financialOverview.status === "verified" ? undefined : t.overview.verification}
            pendingLabel={SITE.figurePending}
          />
        </div>
      </Section>

      <Section tone="white" pad="lg" aria-label={t.heading}>
        {cards.length > 0 && (
        <div data-anim-stagger className={cards.length > 1 ? "mb-14 grid gap-8 md:grid-cols-3" : "mb-14 grid gap-8"}>
          {cards.includes("reports") && (
          <div>
            <DocumentCard {...t.reports} documents={reports} />
          </div>
          )}
          {cards.includes("financial") && (
          <div>
            <DocumentCard {...t.financial} documents={financial} />
          </div>
          )}
          {cards.includes("governance") && (
          <div>
            <DocumentCard
              {...t.governance}
              documents={governanceDocs}
              empty={hasGovernance ? undefined : t.governance.empty}
            >
              {hasGovernance && (
                <div className="mt-3 grid gap-4">
                  {governance.intro && <p className="text-copy">{governance.intro}</p>}
                  {governance.sections.map((s) => (
                    <div key={s.heading} className="border-t-2 border-dashed border-hair pt-3">
                      <h4 className="font-extrabold text-fg">{s.heading}</h4>
                      <p className="mt-1 text-quiet">{s.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </DocumentCard>
          </div>
          )}
        </div>
        )}

        {accountability.intro && (
          <section id={t.accountability.id} aria-labelledby={`${headingId}-acc`} className="reveal grid scroll-mt-[calc(var(--header-h)+1rem)] gap-4 border-t-2 border-edge pt-10 md:grid-cols-[4fr_8fr] md:gap-12">
            <h3 id={`${headingId}-acc`} className="type-card">
              {t.accountability.heading}
            </h3>
            <div>
              {(Array.isArray(accountability.intro) ? accountability.intro : [accountability.intro]).map((text) => (
                <p key={text} className="mt-3 text-[18px] leading-relaxed text-copy first:mt-0">
                  {text}
                </p>
              ))}
            </div>
          </section>
        )}
      </Section>
    </>
  );
}
