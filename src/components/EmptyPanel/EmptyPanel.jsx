import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Mark from "../Mark/Mark.jsx";

/* An empty state that looks deliberate: one sentence saying what is still
   to come, the pale mark in the corner, and optionally a way on to
   something that does exist. Document 05's pattern — a pending section is
   a state of the product, not a failure, and should not look broken.

   `surface` is the ground it sits ON: "paper" (white) gets a Light Gray
   panel, "mist" a white one, so it always stands off its section. */
export default function EmptyPanel({ text, cta, surface = "paper", className = "" }) {
  return (
    <div
      className={cx(
        "relative flex flex-col gap-6 overflow-hidden rounded-3xl p-8 sm:p-10 md:flex-row md:items-center md:justify-between md:p-12",
        surface === "mist" ? "bg-paper-white" : "bg-mist",
        className
      )}
    >
      <Mark
        className="pointer-events-none absolute -bottom-10 -right-10 text-bumble-honey/10"
        style={{ width: "12rem", height: "12rem" }}
      />
      <p className="relative max-w-xl text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
        {text}
      </p>
      {cta && (
        <Button variant="outline" to={cta.to} className="relative self-start md:self-auto">
          {cta.label}
        </Button>
      )}
    </div>
  );
}
