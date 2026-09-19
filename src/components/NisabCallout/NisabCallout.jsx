import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* The "how to calculate" explainer: copy left, the two Nisab thresholds
   as white tiles right, one Light Gray card around the lot. */
export default function NisabCallout({ heading, paragraphs, values, note, cta }) {
  return (
    <section className="py-10 md:py-16">
      <Container>
        <div className="reveal grid gap-10 rounded-3xl rounded-br-[5rem] bg-mist p-8 md:grid-cols-2 md:p-14">
          <div>
            <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
              {heading}
            </h2>
            {paragraphs.map((text) => (
              <p key={text} className="mt-4 max-w-prose">
                {text}
              </p>
            ))}
            <Button to={cta.to} className="mt-8">
              {cta.label}
            </Button>
          </div>

          <div className="flex flex-col justify-center gap-6">
            {values.map((v) => (
              <div key={v.label} className="rounded-3xl rounded-tr-[3rem] bg-paper-white p-8">
                <p className="text-[length:var(--text-caption)] font-semibold tracking-caption">
                  {v.label}
                </p>
                <p className="mt-3 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
                  {v.value}
                </p>
              </div>
            ))}
            {note && (
              <p className="text-[length:var(--text-caption)] tracking-caption">
                {note}
              </p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
