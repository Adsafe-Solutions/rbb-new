import { useId } from "react";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Mission and vision as two separate statements, side by side from `lg`
   and stacked below it — mission first in both, because a mission is what
   you do and a vision is where it leads.

   Two blocks, two grounds: the mission on Deep Trust Blue, the vision on
   Light Gray. They are never one paragraph and never one card; Document 03
   is explicit that the two stay distinct. Each statement is set large —
   this is the one section of the page meant to be read twice.

   `source` says where the words come from, in words, under both. */
function Statement({ label, statement, tone }) {
  const blue = tone === "blue";

  return (
    <div
      className={
        blue
          ? "relative overflow-hidden rounded-3xl rounded-tl-[5rem] bg-trust-blue p-8 text-paper-white sm:p-10 md:p-14"
          : "relative overflow-hidden rounded-3xl rounded-br-[5rem] bg-mist p-8 sm:p-10 md:p-14"
      }
    >
      {blue && (
        <Mark
          className="pointer-events-none absolute -bottom-16 -right-16 text-paper-white/[0.06]"
          style={{ width: "16rem", height: "16rem" }}
        />
      )}
      <h3
        className={
          blue
            ? "relative flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-paper-white/85"
            : "relative flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue"
        }
      >
        <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
        {label}
      </h3>
      <p
        className={
          blue
            ? "relative mt-6 font-semibold text-[length:clamp(1.5rem,2.6vw,2.25rem)] leading-[1.3] tracking-heading-sm text-paper-white"
            : "relative mt-6 font-semibold text-[length:clamp(1.5rem,2.6vw,2.25rem)] leading-[1.3] tracking-heading-sm text-trust-blue"
        }
      >
        {statement}
      </p>
    </div>
  );
}

export default function MissionVision({ id, kicker, heading, mission, vision, source }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] pb-20 md:pb-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        <div className="reveal mt-12 grid gap-cards md:mt-14 lg:grid-cols-2">
          <Statement {...mission} tone="blue" />
          <Statement {...vision} tone="mist" />
        </div>

        {source && (
          <p className="reveal mt-6 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
            {source}
          </p>
        )}
      </Container>
    </section>
  );
}
