import { cx } from "../../lib/cx.js";
import Badge from "../Badge/Badge.jsx";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A take-action card on the Ink surface: photograph left with a convex
   curved edge, tag + heading + copy + button right.

   This is where the `inverse` button finally earns its place — paper on
   ink, the exact mirror of the site's one filled button, so a call to
   action reads the same on a dark ground as on a light one. */
export default function ActionCard({ tag, heading, body, cta, src, alt }) {
  return (
    <section className="py-10 md:py-16">
      <Container>
        <div className="reveal grid overflow-hidden rounded-3xl bg-bumble-ink text-paper-white md:grid-cols-[2fr_3fr]">
          <div
            className={cx(
              "aspect-[4/3] overflow-hidden rounded-b-[4rem]",
              "md:aspect-auto md:min-h-[26rem] md:rounded-b-none md:rounded-r-[6rem]"
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

          <div className="flex flex-col items-start justify-center px-6 py-12 md:px-16 md:py-20">
            <Badge className="uppercase">{tag}</Badge>

            <h2 className="mt-5 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading text-paper-white">
              {heading}
            </h2>

            <p className="mt-4 max-w-prose text-paper-white/80">{body}</p>

            <Button variant="inverse" to={cta.to} className="mt-8">
              {cta.label}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
