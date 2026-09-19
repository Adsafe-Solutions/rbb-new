import Container from "../Container/Container.jsx";

/* A numbered process — three or four cards on the Mist band, each led by
   its number in a light-gray disc, the number itself set in Sky Blue. */
export default function Steps({ heading, items }) {
  return (
    <section className="bg-mist py-20 md:py-32">
      <Container>
        <h2 className="reveal text-center font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          {heading}
        </h2>

        <ol className="reveal mt-14 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.title} className="rounded-3xl rounded-tr-[3rem] bg-paper-white p-8 md:p-10">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-mist font-bold text-[length:var(--text-subheading)] text-bumble-honey">
                {i + 1}
              </span>
              <h3 className="mt-6 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                {item.title}
              </h3>
              <p className="mt-3 text-graphite">{item.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
