import { useId } from "react";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A section of downloadable documents — annual reports, financial
   statements, governance papers — each a small printed card with its
   type and year stamped on it.

   Documents are { id, title, year?, type?, description?, fileUrl } and
   ONLY arrive here already filtered to approved ones with a real file
   (content/transparency.js → publishedDocuments). With none, `empty` says
   they are to come; there is never a placeholder link to a file that
   does not exist.

   Each document is one link whose accessible name includes its type and
   year, so a screen reader knows what it is about to open. `children`
   render above the list — governance puts its approved text there.
   `surface` ("mist") is the old name for the paper band. */
export default function DocumentList({ id, index, kicker, heading, documents, empty, surface, tone, children }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone ?? (surface === "mist" ? "paper" : "white")} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
      {children}
      {documents.length > 0 ? (
        <ul data-anim-stagger className="mt-12 grid gap-8 md:grid-cols-2">
          {documents.map((doc) => {
            const meta = [doc.type, doc.year].filter(Boolean).join(" · ");
            return (
              <li key={doc.id}>
                <OffsetCard lift pad="sm" className="group flex h-full items-start gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pop text-on-pop">
                    <LineIcon name="document" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {meta && <span className="type-meta block text-quiet">{meta}</span>}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-[20px] font-extrabold leading-snug text-fg after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {doc.title}
                      {meta && <span className="sr-only"> ({meta})</span>}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    {doc.description && <span className="mt-2 block text-quiet">{doc.description}</span>}
                  </span>
                </OffsetCard>
              </li>
            );
          })}
        </ul>
      ) : (
        empty && <EmptyPanel text={empty} className="reveal mt-12" />
      )}
    </Section>
  );
}
