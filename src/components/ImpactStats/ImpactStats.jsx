import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import Button from "../Button/Button.jsx";

/* A row of headline numbers, each on its own card with a swooped top-right
   corner. One card can be `highlight`ed — it goes Deep Trust Blue (never
   the bright Sky Blue as a fill) and its number drops to the bottom of
   the card, which is what makes it read as the headline figure rather
   than the first of four equals.

   `surface` is the band behind the cards. On Mist the white cards already
   step forward and get no shadow; on Paper they need the one approved
   shadow to lift off the page.

   `branded` puts RBB on the cards themselves: the mark over the heading,
   an icon tile per figure, the label in Sky Blue caps, the number in Deep
   Trust Blue, and the mark again, oversized and faint, bled off each
   card's bottom-right corner. Without it the numbers are just numbers —
   nothing on them says whose. The watermark is cropped by the card's own
   `overflow-hidden`, so it reads as part of the card and never spills
   into the gap between cards. */

const SURFACES = {
  mist: "bg-mist",
  paper: "bg-paper-white",
};

/* Inline glyphs, keyed by the content's `icon`. A lookup map rather than
   an icon package: three shapes do not justify a dependency, and a map
   keeps every class string literal for Tailwind to find. */
const ICONS = {
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.2 14.4c2.6.2 4.3 1.9 4.8 4.6" />
    </>
  ),
  relief: (
    <>
      <path d="M12 3.5 4.5 6.5v5.2c0 4.4 3.1 7.7 7.5 8.8 4.4-1.1 7.5-4.4 7.5-8.8V6.5z" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  water: (
    <>
      <path d="M12 3.5c3 3.6 6 7.2 6 10.7a6 6 0 0 1-12 0c0-3.5 3-7.1 6-10.7z" />
      <path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.7" />
    </>
  ),
  /* A globe — "countries reached". */
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z" />
    </>
  ),
  /* Two joined hands — "partners & donors". */
  partners: (
    <>
      <path d="M3.5 12.5 7 9l3 1.2 2.5-1.7 3 .2L20.5 12" />
      <path d="M7 9 3.5 12.5l4.3 4.3a1.6 1.6 0 0 0 2.3 0l.6-.6a1.6 1.6 0 0 0 2.3 0l.8-.8a1.6 1.6 0 0 0 2.3 0l1.9-1.9a1.6 1.6 0 0 0 0-2.3L16.5 9" />
    </>
  ),
};

function StatIcon({ name, inverted }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-12 w-12 items-center justify-center rounded-2xl",
        inverted ? "bg-paper-white/15 text-paper-white" : "bg-bumble-honey/15 text-bumble-honey"
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        {glyph}
      </svg>
    </span>
  );
}

/* For RBB's own figures (Documents 02, 05): `kicker` over the heading;
   `note` — the verification line, shown whenever a figure is still
   pending (content/impact.js `metricsNote`), in words and never dropped;
   `source` — where the figures come from; `cta` — a way on. `id` makes the
   section a jump target (/impact#at-a-glance). */
export default function ImpactStats({
  id,
  kicker,
  heading,
  stats,
  surface = "mist",
  branded = false,
  note,
  source,
  cta,
}) {
  return (
    <section
      id={id}
      className={cx("scroll-mt-[var(--header-h)] py-20 md:py-32", SURFACES[surface] ?? SURFACES.mist)}
    >
      <Container>
        {heading && (
          <div className="reveal flex flex-col items-center text-center">
            {branded && <Mark className="h-12 w-12 text-bumble-honey" />}
            {kicker && (
              <p className={cx("text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue", branded && "mt-4")}>
                {kicker}
              </p>
            )}
            <h2
              className={cx(
                "font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg",
                branded && "mt-5"
              )}
            >
              {heading}
            </h2>
          </div>
        )}

        <ul
          className={cx(
            "reveal grid gap-cards sm:grid-cols-2",
            stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
            heading && "mt-14"
          )}
        >
          {stats.map((stat, i) => (
            <li
              key={i}
              className={cx(
                "relative flex flex-col overflow-hidden rounded-3xl rounded-tr-[3rem] p-8 md:p-10",
                stat.highlight
                  ? "bg-trust-blue text-paper-white"
                  : cx("bg-paper-white", surface === "paper" && "shadow-sm")
              )}
            >
              {branded && (
                <Mark
                  className={cx(
                    "pointer-events-none absolute -bottom-12 -right-12 h-44 w-44",
                    stat.highlight ? "text-paper-white/10" : "text-bumble-honey/10"
                  )}
                />
              )}

              {/* `relative` so the copy paints above the watermark, which is
                  absolutely placed and would otherwise sit on top of it. */}
              <div className="relative flex flex-1 flex-col">
                {branded && stat.icon && (
                  <div className="mb-6">
                    <StatIcon name={stat.icon} inverted={stat.highlight} />
                  </div>
                )}

                <p
                  className={cx(
                    "text-[length:var(--text-caption)] font-semibold tracking-caption",
                    branded && "uppercase tracking-[0.12em]",
                    /* Charcoal, not Sky Blue: Sky Blue text on white is
                       2.55:1 (WCAG 1.4.3 asks 4.5:1 at this size). The sky
                       accent stays in the icon tile and the watermark. */
                    branded && !stat.highlight && "text-bumble-ink"
                  )}
                >
                  {stat.label}
                </p>

                <div className={cx("mt-3", !branded && "mt-6", stat.highlight && "mt-auto pt-10")}>
                  <p
                    className={cx(
                      "font-bold text-[length:var(--text-heading)] leading-heading tracking-heading",
                      branded && !stat.highlight && "text-trust-blue"
                    )}
                  >
                    {stat.value}
                  </p>
                  {stat.note && (
                    <p className={cx("mt-1", stat.highlight ? "text-paper-white/80" : "text-graphite")}>
                      {stat.note}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {(source || note || cta) && (
          <div className="reveal mt-10 flex flex-col items-center gap-6 text-center">
            {(source || note) && (
              <p className="max-w-prose text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                {source}
                {source && note && " "}
                {note && <strong className="font-semibold text-bumble-ink">{note}</strong>}
              </p>
            )}
            {cta && (
              <Button to={cta.to} variant="outline">
                {cta.label}
              </Button>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
