import { useId } from "react";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An organisation's values, as a numbered editorial list — a rule above
   each, the number small, the value large — rather than a row of icon
   cards. Items are { title, description? } and come straight from content.

   With no items it shows `fallback` in a quiet panel: the section keeps
   its place and its heading, and says plainly that the values are still
   to come. It never fills the gap with generic ones. */
export default function ValuesList({ id, kicker, heading, items, fallback }) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[var(--header-h)] bg-mist py-20 md:py-28"
    >
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        {items.length > 0 ? (
          <ol className="reveal mt-12 grid gap-x-12 gap-y-10 md:mt-14 md:grid-cols-2 lg:grid-cols-3">
            {items.map((value, i) => (
              <li key={value.title} className="border-t-2 border-bumble-honey pt-6">
                <span className="text-[length:var(--text-caption)] font-semibold tracking-caption text-trust-blue">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm">
                  {value.title}
                </h3>
                {value.description && <p className="mt-3 text-graphite">{value.description}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <div className="reveal relative mt-12 overflow-hidden rounded-3xl bg-paper-white p-8 sm:p-10 md:mt-14 md:p-14">
            <Mark
              className="pointer-events-none absolute -bottom-10 -right-10 text-bumble-honey/10"
              style={{ width: "12rem", height: "12rem" }}
            />
            <p className="relative max-w-xl text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
              {fallback}
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}
