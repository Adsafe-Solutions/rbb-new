import { useId } from "react";
import Container from "../Container/Container.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A financial breakdown as shares of a whole: one segmented bar, and the
   same figures as a list beneath it.

   The LIST is the content — a <dl> of label and percentage that a screen
   reader reads in full and that survives any stylesheet. The bar is
   `aria-hidden` decoration on top of it. Segments are told apart by
   pattern as well as colour (solid, a lighter solid, diagonal stripes),
   and each list entry carries the same swatch, so no category depends on
   colour alone.

   Only shares are drawn: no amounts, and no reading of what the shares
   mean. `caption` says where the figures come from; `note` anything the
   reader must know about their status. Items are { id, label,
   percentage }. */
const SWATCHES = [
  { backgroundColor: "var(--color-trust-blue)" },
  { backgroundColor: "var(--color-bumble-honey)" },
  {
    backgroundColor: "var(--color-paper-white)",
    backgroundImage:
      "repeating-linear-gradient(135deg, var(--color-growth-green) 0 4px, transparent 4px 9px)",
    boxShadow: "inset 0 0 0 2px var(--color-growth-green)",
  },
  { backgroundColor: "var(--color-graphite)" },
];

export default function FinancialOverview({ id, kicker, heading, items, caption, note }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        <figure className="reveal mt-12 md:mt-14">
          <div aria-hidden="true" className="flex h-14 w-full overflow-hidden rounded-2xl bg-mist md:h-16">
            {items.map((item, i) => (
              <span
                key={item.id}
                className="h-full border-r-2 border-paper-white last:border-r-0"
                style={{ width: `${item.percentage}%`, ...SWATCHES[i % SWATCHES.length] }}
              />
            ))}
          </div>

          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            {items.map((item, i) => (
              <div key={item.id} className="flex flex-col-reverse gap-1 border-t-2 border-mist pt-5">
                <dt className="flex items-center gap-3 text-[length:var(--text-body)] leading-body text-bumble-ink">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded"
                    style={SWATCHES[i % SWATCHES.length]}
                  />
                  {item.label}
                </dt>
                <dd className="font-bold leading-none tracking-heading-lg text-[length:clamp(2.75rem,5vw,4rem)] text-trust-blue">
                  {item.percentage}%
                </dd>
              </div>
            ))}
          </dl>

          <figcaption className="mt-8 max-w-prose text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
            {caption}
            {/* A real space: `block` breaks the line visually, but the
                caption is read as one run of text. */}
            {note && " "}
            {note && <span className="mt-1 block font-medium text-bumble-ink">{note}</span>}
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
