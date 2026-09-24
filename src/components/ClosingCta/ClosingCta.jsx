import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import Picture from "../Picture/Picture.jsx";

/* The page's last word before the footer: a full-width Light Gray band,
   the heading set large, two calls to action, and one photograph.

   Light Gray rather than blue on purpose. The footer below it is Deep
   Trust Blue, and a blue band straight above it would merge into one
   undivided block; the change of ground is what makes this read as the
   close of the page and the footer as something after it.

   Props: { heading, body?, ctas: { primary, secondary? }, image?: { src,
   alt, focal } }. Without an image it is the copy alone, centred — how
   /about closes, having no approved photograph to spare.

   `children` render under the buttons — the program pages put their
   links to the other program areas there. */
export default function ClosingCta({ heading, body, ctas, image, children }) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="relative overflow-hidden bg-mist py-20 md:py-28"
    >
      <Mark
        className="pointer-events-none absolute -left-16 bottom-0 hidden text-bumble-honey/10 lg:block"
        style={{ width: "22rem", height: "22rem" }}
      />

      <Container
        className={
          image
            ? "relative grid items-center gap-12 lg:grid-cols-[6fr_5fr] lg:gap-20"
            : "relative text-center"
        }
      >
        <div className="reveal">
          <h2
            id={headingId}
            className="font-bold text-[length:clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-heading-lg"
          >
            {heading}
          </h2>
          {body && (
            <p
              className={
                image
                  ? "mt-6 max-w-prose text-graphite"
                  : "mx-auto mt-6 max-w-prose text-graphite"
              }
            >
              {body}
            </p>
          )}
          <div
            className={
              image
                ? "mt-9 flex flex-wrap items-center gap-4"
                : "mt-9 flex flex-wrap items-center justify-center gap-4"
            }
          >
            <Button to={ctas.primary.to}>{ctas.primary.label}</Button>
            {ctas.secondary && (
              <Button variant="outline" to={ctas.secondary.to}>
                {ctas.secondary.label}
              </Button>
            )}
          </div>
          {children}
        </div>

        {image && (
          <div className="reveal aspect-[4/3] overflow-hidden rounded-3xl rounded-bl-[6rem]">
            <Picture
              sizes="(min-width: 1024px) 40vw, 100vw"
              src={image.src}
              alt={image.alt}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: image.focal }}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </Container>
    </section>
  );
}
