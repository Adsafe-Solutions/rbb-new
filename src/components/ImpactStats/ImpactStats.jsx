import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* A row of headline numbers, each on its own card with a swooped top-right
   corner. One card can be `highlight`ed — it goes Deep Trust Blue (never
   the bright Sky Blue as a fill) and its number drops to the bottom of
   the card, which is what makes it read as the headline figure rather
   than the first of four equals.

   `surface` is the band behind the cards. On Mist the white cards already
   step forward and get no shadow; on Paper they need the one approved
   shadow to lift off the page. */

const SURFACES = {
  mist: "bg-mist",
  paper: "bg-paper-white",
};

export default function ImpactStats({ heading, stats, surface = "mist" }) {
  return (
    <section className={cx("py-20 md:py-32", SURFACES[surface] ?? SURFACES.mist)}>
      <Container>
        {heading && (
          <h2
            className={cx(
              "reveal text-center font-bold text-[length:var(--text-heading-lg)]",
              "leading-heading-lg tracking-heading-lg"
            )}
          >
            {heading}
          </h2>
        )}

        <ul
          className={cx(
            "reveal grid gap-6 sm:grid-cols-2",
            stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
            heading && "mt-14"
          )}
        >
          {stats.map((stat) => (
            <li
              key={stat.label}
              className={cx(
                "flex flex-col rounded-3xl rounded-tr-[3rem] p-8 md:p-10",
                stat.highlight
                  ? "bg-trust-blue text-paper-white"
                  : cx("bg-paper-white", surface === "paper" && "shadow-sm")
              )}
            >
              <p className="text-[length:var(--text-caption)] font-semibold tracking-caption">
                {stat.label}
              </p>

              <div className={cx("mt-6", stat.highlight && "mt-auto pt-10")}>
                <p className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
                  {stat.value}
                </p>
                <p className={cx("mt-1", stat.highlight ? "text-paper-white/80" : "text-graphite")}>
                  {stat.note}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
