import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* Short sections of a long page, as editorial rows: the heading in a
   narrow left column, its content in a wide right one, a rule between
   rows. Used for the program pages' "Why this matters", "What we do",
   "Impact" and "Stories" — one pattern, so four pages built from the same
   template read as one family.

   Each row is its own <section> with an <h2>, so the page outline lists
   every one. A row's content is `body` (a string or paragraphs) and/or
   `items` (a bullet list); with neither, `empty` stands in its place —
   the row keeps its heading and says plainly what is still to come. */
function Row({ row }) {
  const headingId = useId();
  const paragraphs = Array.isArray(row.body) ? row.body : row.body ? [row.body] : [];
  const items = row.items ?? [];
  const hasContent = paragraphs.length > 0 || items.length > 0;

  return (
    <section
      id={row.id}
      aria-labelledby={headingId}
      className="reveal grid scroll-mt-[var(--header-h)] gap-4 border-t border-mist py-10 md:grid-cols-[4fr_8fr] md:gap-12 md:py-14"
    >
      <h2
        id={headingId}
        className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm"
      >
        {row.heading}
      </h2>
      <div>
        {paragraphs.map((text) => (
          <p key={text} className="mt-4 text-[length:var(--text-subheading)] leading-subheading tracking-subheading first:mt-0">
            {text}
          </p>
        ))}
        {items.length > 0 && (
          <ul className={cx("grid gap-3", paragraphs.length > 0 && "mt-6")}>
            {items.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-bumble-honey" />
                {item}
              </li>
            ))}
          </ul>
        )}
        {!hasContent && (
          <p className="text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
            {row.empty}
          </p>
        )}
      </div>
    </section>
  );
}

export default function ContentRows({ rows, className = "" }) {
  return (
    <div className={cx("py-8 md:py-12", className)}>
      <Container>
        <div className="border-b border-mist">
          {rows.map((row) => (
            <Row key={row.heading} row={row} />
          ))}
        </div>
      </Container>
    </div>
  );
}
