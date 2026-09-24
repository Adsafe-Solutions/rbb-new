import { Link } from "react-router-dom";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";

/* Reports & Accountability, on a full-bleed Deep Trust Blue band.

   Left: the claim and the three commitments behind it. Right: the
   documents themselves, as cards. The point of the layout is that the
   claim and its evidence sit side by side — a section that asks for trust
   and offers nothing to check is the thing this replaced.

   Dark on purpose. It is the one full-bleed dark band between the hero and
   the footer, so it lands as a change of register — the page stops
   appealing and starts accounting — rather than as another pale box.

   ⚠ The <h2> sets its own colour. styles/index.css makes every heading
   Deep Trust Blue via :where(), and on this band that is blue on blue. */

function CheckIcon() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bumble-honey text-trust-blue"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function DocIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bumble-honey/15 text-bumble-honey"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function AccountabilityBand({
  kicker,
  heading,
  body,
  commitments,
  documents,
  cta,
}) {
  return (
    <section className="relative overflow-hidden bg-trust-blue py-20 text-paper-white md:py-28">
      {/* The mark, huge and faint, bled off the right edge — the same
          device the hero uses on the left, so the two dark bands on the
          page answer each other. */}
      <Mark className="pointer-events-none absolute -right-[12%] top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 text-paper-white/[0.05]" />

      <Container className="relative grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="reveal">
          <p className="text-[length:var(--text-caption)] font-medium uppercase tracking-[0.18em] text-bumble-honey">
            {kicker}
          </p>
          <h2 className="mt-4 font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg text-paper-white">
            {heading}
          </h2>
          <p className="mt-6 max-w-prose text-paper-white/80">{body}</p>

          {/* Each is a promise with a tick beside it, so none renders
              until RBB has confirmed it can stand behind it. */}
          {commitments.length > 0 && (
            <ul className="mt-8 space-y-4">
              {commitments.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckIcon />
                  <span className="text-paper-white">{item}</span>
                </li>
              ))}
            </ul>
          )}

          <Button variant="inverse" to={cta.to} className="mt-10">
            {cta.label}
          </Button>
        </div>

        {/* The documents. Real links, one per document, so each is its
            own tab stop and its own destination the day the PDFs exist. */}
        <ul className="reveal flex flex-col gap-stack">
          {documents.map((doc) => (
            <li key={doc.title}>
              <Link
                to={doc.to}
                className="group flex items-center gap-5 rounded-3xl bg-paper-white/[0.06] p-5 ring-1 ring-inset ring-paper-white/15 transition-colors hover:bg-paper-white/[0.12] md:p-6"
              >
                <DocIcon />
                <span className="flex-1">
                  <span className="block font-semibold text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-paper-white">
                    {doc.title}
                  </span>
                  <span className="mt-1 block text-[length:var(--text-caption)] leading-caption tracking-caption text-paper-white/65">
                    {doc.meta}
                  </span>
                </span>
                <span className="text-bumble-honey">
                  <ArrowIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
