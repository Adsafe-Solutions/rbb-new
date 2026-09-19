import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* An inner-page hero: the same Light Gray band as the homepage's, with a
   single photograph in place of the swipe deck.

   Pulls itself up under the fixed header exactly as Hero does — see the
   note there; all three offsets read `--header-h`. */
export default function PageHero({ heading, body, cta, src, alt }) {
  return (
    <section className="-mt-[var(--header-h)] bg-mist pt-[var(--header-h)]">
      <Container className="grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[6fr_5fr] lg:gap-20">
        <div className="reveal">
          <h1
            className={cx(
              "font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg",
              "md:text-[length:clamp(3.5rem,5vw,4.5rem)]"
            )}
          >
            {heading}
          </h1>
          <p className="mt-4 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
            {body}
          </p>
          {cta && (
            <Button to={cta.to} className="mt-8">
              {cta.label}
            </Button>
          )}
        </div>

        <div className="reveal aspect-[4/3] overflow-hidden rounded-3xl rounded-tr-[5rem] shadow-sm">
          <img src={src} alt={alt} decoding="async" className="h-full w-full object-cover" />
        </div>
      </Container>
    </section>
  );
}
