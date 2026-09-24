import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A section of downloadable documents — annual reports, financial
   statements, governance papers. Documents are { id, title, year?,
   type?, description?, fileUrl } and ONLY arrive here already filtered to
   approved ones with a real file (content/transparency.js →
   publishedDocuments). With none, `empty` says they are to come; there is
   never a placeholder link to a file that does not exist.

   Each document is one link whose accessible name includes its type and
   year ("Annual Report 2026 (PDF, 2026)"), so a screen reader knows what
   it is about to open before it opens it. `children` render above the
   list — governance puts its approved text there, and passes no `empty`
   once it has, so no pending panel sits under real content. */
export default function DocumentList({ id, kicker, heading, documents, empty, surface = "paper", children }) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx("scroll-mt-[var(--header-h)] py-20 md:py-28", surface === "mist" && "bg-mist")}
    >
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />
        {children}

        {documents.length > 0 ? (
          <ul className="reveal mt-10 grid gap-stack md:grid-cols-2">
            {documents.map((doc) => {
              const meta = [doc.type, doc.year].filter(Boolean).join(" · ");
              return (
                <li key={doc.id}>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cx(
                      "group flex items-start gap-5 rounded-2xl p-5 transition-colors",
                      surface === "mist" ? "bg-paper-white" : "bg-mist",
                      "hover:bg-bumble-honey/15"
                    )}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bumble-honey/12 text-trust-blue">
                      <LineIcon name="document" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-trust-blue underline-offset-4 group-hover:underline">
                        {doc.title}
                      </span>{" "}
                      {meta && (
                        <span className="mt-0.5 block text-[length:var(--text-caption)] leading-caption text-graphite">
                          {meta}
                        </span>
                      )}
                      {doc.description && <span className="mt-2 block text-graphite">{doc.description}</span>}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          empty && <EmptyPanel text={empty} surface={surface} className="reveal mt-10" />
        )}
      </Container>
    </section>
  );
}
