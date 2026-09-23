import Container from "../Container/Container.jsx";

/* A heading, an intro, and a row of short feature cards — the "why trust
   us" pattern. Cards on the Mist band, each with the short Honey rule the
   stat cards use, so numbers and promises share one mark. */
export default function FeatureGrid({ heading, intro, items }) {
  return (
    <section className="bg-mist py-20 md:py-32">
      <Container>
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
          {intro && <p className="mt-4 text-graphite">{intro}</p>}
        </div>

        <ul className="reveal mt-14 grid gap-cards sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.title} className="rounded-3xl rounded-tr-[3rem] bg-paper-white p-8">
              <h3 className="border-l-4 border-bumble-honey pl-3 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                {item.title}
              </h3>
              <p className="mt-4 text-graphite">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
