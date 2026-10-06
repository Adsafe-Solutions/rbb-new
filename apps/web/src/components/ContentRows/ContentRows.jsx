import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";
import Section from "../Section/Section.jsx";

/* Short sections of a long page, as numbered editorial rows: a chapter
   number and the heading in a narrow left column, the content in a wide
   right one, a 2px rule between rows — the layout of a report, not a
   stack of cards. Used for a program's "Why this matters" / "What we
   do", a project's facts, a policy's parts — one pattern, so pages built
   from the same template read as one family.

   Each row is its own <section> with an <h2>, so the page outline lists
   every one. A row's content is `body` (a string or paragraphs) and/or
   `items` (a list, bulleted with the mark); with neither, `empty` stands
   in its place on a dashed "to be filled in" line — the row keeps its
   heading and says plainly what is still to come.

   On desktop the heading column is sticky, so a long row keeps its name
   in view while it is read. `tone` is the band; `start` the number the
   first row takes.

   `aside` turns the band into a detail layout: the aside — a ticket of a
   project's facts — in a sticky rail on the left from `lg`, the rows
   stacked beside it, heading over content. On a phone the rail comes
   first, in flow, and nothing sticks. */
function Row({ row, number, stacked }) {
  const headingId = useId();
  const paragraphs = Array.isArray(row.body) ? row.body : row.body ? [row.body] : [];
  const items = row.items ?? [];
  const hasContent = paragraphs.length > 0 || items.length > 0;

  return (
    <section
      id={row.id}
      aria-labelledby={headingId}
      className={cx(
        "reveal grid scroll-mt-[var(--header-h)] gap-5 border-t-2 border-edge py-10 md:py-14",
        !stacked && "md:grid-cols-[4fr_8fr] md:gap-12"
      )}
    >
      <div className={cx(!stacked && "md:sticky md:top-[calc(var(--header-h)+1.5rem)] md:self-start")}>
        <p aria-hidden="true" className="type-meta text-quiet">
          {String(number).padStart(2, "0")}
        </p>
        <h2 id={headingId} className="type-card mt-2">
          {row.heading}
        </h2>
      </div>
      <div className="min-w-0">
        {paragraphs.map((text, i) => (
          <p key={text} className={cx(i === 0 ? "type-lead text-copy" : "mt-5 max-w-[64ch] text-copy")}>
            {text}
          </p>
        ))}
        {items.length > 0 && (
          <ul className={cx("grid gap-4", paragraphs.length > 0 && "mt-7")}>
            {items.map((item) => (
              <li key={item} className="flex gap-3.5 text-[18px] leading-relaxed text-copy">
                <Mark className="mt-1.5 h-4 w-4 shrink-0 text-pop" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
        {!hasContent && (
          <p className="type-lead rounded-xl border-2 border-dashed border-hair px-5 py-4 text-quiet">{row.empty}</p>
        )}
      </div>
    </section>
  );
}

export default function ContentRows({ rows, tone = "white", start = 1, aside, className = "" }) {
  const list = (
    <div className="min-w-0 border-b-2 border-edge">
      {rows.map((row, i) => (
        <Row key={row.heading} row={row} number={start + i} stacked={Boolean(aside)} />
      ))}
    </div>
  );

  return (
    <Section tone={tone} pad="md" as="div" className={className}>
      {aside ? (
        <div className="grid gap-12 lg:grid-cols-[19rem_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start lg:pt-10">{aside}</div>
          {list}
        </div>
      ) : (
        list
      )}
    </Section>
  );
}
