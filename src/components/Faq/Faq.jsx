import Container from "../Container/Container.jsx";

/* An FAQ accordion on native <details>. No state, no ARIA to get wrong:
   the browser handles open/close, keyboard and the accessible name.
   `name` groups them so opening one closes the others. */

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-6 w-6 shrink-0 transition-transform group-open:rotate-180"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Faq({ heading, items }) {
  return (
    <section className="bg-mist py-20 md:py-32">
      <Container>
        <h2 className="reveal text-center font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          {heading}
        </h2>

        <div className="reveal mx-auto mt-14 flex max-w-4xl flex-col gap-3">
          {items.map((item) => (
            <details key={item.q} name="faq" className="group rounded-3xl bg-paper-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-8 py-6 font-semibold text-[length:var(--text-subheading)] leading-subheading tracking-subheading [&::-webkit-details-marker]:hidden">
                {item.q}
                <Chevron />
              </summary>
              <div className="px-8 pb-8 text-graphite">
                {(Array.isArray(item.a) ? item.a : [item.a]).map((text) => (
                  <p key={text} className="mt-2 first:mt-0">
                    {text}
                  </p>
                ))}
                {item.list && (
                  <ul className="mt-3 list-disc space-y-1 pl-6">
                    {item.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
