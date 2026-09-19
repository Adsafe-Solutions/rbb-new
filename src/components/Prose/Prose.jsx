import Container from "../Container/Container.jsx";

/* A centred heading and a short run of paragraphs. The plainest section
   on the site, for copy that needs nothing around it. */
export default function Prose({ heading, paragraphs }) {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
          {paragraphs.map((text) => (
            <p key={text} className="mt-6 text-graphite">
              {text}
            </p>
          ))}
        </div>
      </Container>
    </section>
  );
}
