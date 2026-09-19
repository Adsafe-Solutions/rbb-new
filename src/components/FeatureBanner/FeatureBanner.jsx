import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A programme banner: photograph left, coloured panel right, one big
   swooping corner where the two meet.

   The swoop is the signature of these sections and is deliberately larger
   than any radius in the token scale — it reads as a shape, not a corner.
   It is the only place the site goes past 24px, so keep it here.

   ⚠ Plain <img>, not components/Photo. Photo carries its own 16px radius
   on every corner, and on the two corners that must stay square (where
   the picture meets the panel) that rounding shows as a notch with the
   panel colour bleeding through. The wrapper owns the clipping instead. */

const SURFACES = {
  honey: "bg-mist",
  pollen: "bg-pollen",
  mist: "bg-mist",
};

export default function FeatureBanner({
  surface = "honey",
  src,
  alt,
  heading,
  body,
  cta,
}) {
  const paragraphs = Array.isArray(body) ? body : [body];

  return (
    <section className="py-10 md:py-16">
      <Container>
        <div
          className={cx(
            "reveal grid overflow-hidden rounded-3xl md:grid-cols-[1fr_2fr] md:rounded-br-[5rem]",
            SURFACES[surface] ?? SURFACES.honey
          )}
        >
          {/* Fixed height on md+, not min-height: a portrait photograph
              would otherwise set the row height from its own aspect ratio
              and the banner would grow to a full screen tall. */}
          <div
            className={cx(
              "aspect-[4/3] overflow-hidden rounded-br-[4rem]",
              "md:aspect-auto md:h-[26rem] md:rounded-br-none md:rounded-tr-[5rem]"
            )}
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col items-center justify-center px-6 py-12 text-center md:px-16 md:py-20">
            <h2
              className={cx(
                "font-bold text-[length:var(--text-heading)] leading-heading tracking-heading",
                "md:text-[length:var(--text-heading-lg)] md:leading-heading-lg md:tracking-heading-lg"
              )}
            >
              {heading}
            </h2>

            {paragraphs.map((text) => (
              <p key={text} className="mt-4 max-w-prose">
                {text}
              </p>
            ))}

            {cta && (
              <Button variant="inverse" to={cta.to} className="mt-8">
                {cta.label}
              </Button>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
