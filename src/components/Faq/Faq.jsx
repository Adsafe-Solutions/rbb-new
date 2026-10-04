import { useId } from "react";
import Mark from "../Mark/Mark.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An FAQ accordion on native <details>. No state, no ARIA to get wrong:
   the browser handles open/close, keyboard and the accessible name.
   `name` groups them so opening one closes the others.

   Each question is a full-width sheet in a stack (`gap-stack`); the open
   one takes the accent shadow and its marker turns from a plus into a
   minus. Questions are display weight, answers body text. */
function Marker() {
  return (
    <span aria-hidden="true" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flip text-on-flip transition-colors group-open:bg-pop group-open:text-on-pop">
      <span className="absolute h-0.5 w-4 rounded bg-current" />
      <span className="absolute h-4 w-0.5 rounded bg-current transition-transform duration-200 group-open:scale-y-0" />
    </span>
  );
}

export default function Faq({ id, index, kicker, heading, items, tone = "paper", highlight }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="grid gap-12 lg:grid-cols-[4fr_8fr] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
          <Mark className="mt-10 hidden h-24 w-24 text-pop lg:block" />
        </div>
        <div data-anim-stagger className="flex flex-col gap-stack">
          {items.map((item) => (
            <details
              key={item.q}
              name="faq"
              data-tone="card"
              className="group rounded-2xl border-rim bg-paper-white transition-shadow duration-300 open:cast"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-2xl px-6 py-5 text-[20px] font-extrabold leading-snug text-fg md:px-8 md:py-6 [&::-webkit-details-marker]:hidden">
                {item.q}
                <Marker />
              </summary>
              <div className="px-6 pb-7 text-copy md:px-8">
                {(Array.isArray(item.a) ? item.a : [item.a]).map((text) => (
                  <p key={text} className="mt-3 max-w-[64ch] first:mt-0">
                    {text}
                  </p>
                ))}
                {item.list && (
                  <ul className="mt-4 list-disc space-y-1.5 pl-6 marker:text-trust-blue">
                    {item.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
