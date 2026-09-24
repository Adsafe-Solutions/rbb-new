import { cx } from "../../lib/cx.js";

/* The heading block every homepage section opens with: a small eyebrow,
   the <h2>, and an optional intro line.

   The eyebrow is Deep Trust Blue text behind a short Sky Blue rule, NOT
   Sky Blue text. Sky Blue on white is about 2.6:1 — fine for a rule, a
   fail for 16px type — so the brand colour carries the accent and the
   type stays readable.

   `id` goes on the <h2> so the section can point `aria-labelledby` at it.
   `tone="invert"` is for Deep Trust Blue grounds. */
const TONES = {
  default: { eyebrow: "text-trust-blue", heading: "text-trust-blue", intro: "text-graphite" },
  invert: { eyebrow: "text-paper-white/85", heading: "text-paper-white", intro: "text-paper-white/80" },
};

export default function SectionHeading({
  id,
  kicker,
  heading,
  intro,
  align = "left",
  tone = "default",
  className = "",
}) {
  const t = TONES[tone] ?? TONES.default;
  const centred = align === "center";

  return (
    <div className={cx(centred && "mx-auto text-center", "max-w-3xl", className)}>
      {kicker && (
        <p
          className={cx(
            "flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em]",
            centred && "justify-center",
            t.eyebrow
          )}
        >
          <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
          {kicker}
        </p>
      )}
      <h2
        id={id}
        className={cx(
          "mt-4 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading",
          "md:text-[length:var(--text-heading-lg)] md:leading-heading-lg md:tracking-heading-lg",
          t.heading
        )}
      >
        {heading}
      </h2>
      {intro && (
        <p className={cx("mt-5 max-w-prose text-[length:var(--text-body)]", centred && "mx-auto", t.intro)}>
          {intro}
        </p>
      )}
    </div>
  );
}
