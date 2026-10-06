import { useId } from "react";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A financial breakdown as shares of a whole, on a Deep Trust Blue band:
   one segmented bar across the page, and the same figures as printed
   cards beneath it, each share in display type on the accent block.

   The CARDS are the content — a <dl> of label and percentage that a
   screen reader reads in full and that survives any stylesheet. The bar
   is `aria-hidden` decoration on top of it. Segments are told apart by
   pattern as well as colour (solid white, solid Sky Blue, diagonal
   stripes), and each card carries the same swatch, so no category
   depends on colour alone.

   ⚠ THE STATUS TRAVELS WITH THE FIGURES. `note` is the verification
   line (content/transparency.js decides whether there is one): it is
   printed over the cards, not under them, and every card repeats it in
   short, so a share cannot be read — or screenshotted — as confirmed
   while it is pending. Nothing counts up.

   Only shares are drawn: no amounts, and no reading of what the shares
   mean. `caption` says where the figures come from. Items are { id,
   label, percentage }. */
const SWATCHES = [
  { backgroundColor: "var(--color-paper-white)" },
  { backgroundColor: "var(--color-bumble-honey)" },
  {
    backgroundColor: "var(--color-trust-blue)",
    backgroundImage: "repeating-linear-gradient(135deg, var(--color-paper-white) 0 3px, transparent 3px 9px)",
  },
  { backgroundColor: "var(--color-graphite)" },
];

/* `embedded`: the overview as part of a larger chapter (About's
   Transparency section) — no band of its own, the heading an <h3> under
   the chapter's <h2>, the id on a wrapper so its anchor still lands. */
export default function FinancialOverview({ id, index, kicker, heading, items, caption, note, pendingLabel, tone = "ink", highlight, embedded = false }) {
  const headingId = useId();
  const Wrapper = embedded ? EmbeddedWrapper : Section;

  return (
    <Wrapper id={id} tone={tone} pad="lg" watermark="right" aria-labelledby={headingId}>
      {embedded ? (
        <h3 id={headingId} className="type-card">
          {heading}
        </h3>
      ) : (
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
      )}

      {note && (
        <p className="type-note reveal mt-8 inline-flex max-w-full items-center gap-3 rounded-lg border-2 border-dashed border-pop px-4 py-3 text-fg">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-pop" />
          {note}
        </p>
      )}

      <figure className="mt-12 md:mt-14">
        <div aria-hidden="true" className="reveal flex h-16 w-full overflow-hidden rounded-xl border-2 border-paper-white md:h-20">
          {items.map((item, i) => (
            <span
              key={item.id}
              className="h-full border-r-2 border-trust-blue last:border-r-0"
              style={{ width: `${item.percentage}%`, ...SWATCHES[i % SWATCHES.length] }}
            />
          ))}
        </div>

        {/* Valid list structure: each card IS the <div> that groups one
            <dt>/<dd> pair, directly inside the <dl> (HTML allows exactly
            one wrapper level). The card has no tilt, so it can be the
            staggered reveal target itself. */}
        <dl data-anim-stagger className="mt-12 grid gap-8 sm:grid-cols-3">
          {items.map((item, i) => (
            <OffsetCard key={item.id} className="flex h-full flex-col-reverse">
              <dt className="mt-5 flex items-center gap-3 font-bold text-fg">
                <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded border-2 border-trust-blue" style={SWATCHES[i % SWATCHES.length]} />
                {item.label}
              </dt>
              <dd>
                <span className="hl type-figure">{item.percentage}%</span>
                {note && pendingLabel && <span className="type-meta mt-4 block text-quiet">{pendingLabel}</span>}
              </dd>
            </OffsetCard>
          ))}
        </dl>

        <figcaption className="reveal mt-12 max-w-[64ch] text-copy">{caption}</figcaption>
      </figure>
    </Wrapper>
  );
}

function EmbeddedWrapper({ id, children, ...rest }) {
  return (
    <div id={id} aria-labelledby={rest["aria-labelledby"]} role="group" className="scroll-mt-[calc(var(--header-h)+1rem)]">
      {children}
    </div>
  );
}
