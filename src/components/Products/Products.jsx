import { cx } from "../../lib/cx.js";
import Badge from "../Badge/Badge.jsx";
import Button from "../Button/Button.jsx";
import Photo from "../Photo/Photo.jsx";
import PhoneMock from "../PhoneMock/PhoneMock.jsx";
import Container from "../Container/Container.jsx";
/* Catalogue-only sample data (/components), imported directly rather than
   through content/index.js so it never enters the public build. */
import { PRODUCTS } from "../../content/home.js";

/* The two product cards — Date and Friends — side by side.

   One card is a bordered White frame, the other a Light Gray fill. They
   are siblings, not a primary and a secondary: giving both cards the same
   fill would flatten them into one wide band, and the palette has no
   second warm tone to pair them with the way the old yellow duo did.

   The link out of each card is the underlined `link` variant, never a
   filled button. A filled ink button inside a yellow card would be the
   loudest thing in the section and would compete with the page's real call
   to action further down. */

const SURFACES = {
  honey: "border border-mist bg-paper-white",
  pollen: "bg-pollen",
};

export default function Products() {
  return (
    <section className="pb-16 md:pb-24">
      <Container>
        <div className="grid gap-cards md:grid-cols-2">
          {PRODUCTS.map((product) => (
            <article
              key={product.name}
              className={cx(
                "reveal flex flex-col overflow-hidden rounded-3xl p-3",
                SURFACES[product.surface] ?? SURFACES.honey
              )}
            >
              {/* The app screens sit on a paper plate inside the coloured
                  frame — the frame is the card, the plate is the product.
                  Cropped at the bottom so the phones run out of the plate
                  rather than sitting neatly within it. */}
              <div className="relative h-56 overflow-hidden rounded-2xl bg-paper-white md:h-72">
                <div className="absolute inset-x-0 top-6 flex items-start justify-center gap-3">
                  <Photo
                    src={product.accents[0].src}
                    alt={product.accents[0].alt}
                    ratio="3/4"
                    className="w-24 shrink-0 -rotate-6 shadow-sm md:w-28"
                  >
                    <Badge className="absolute bottom-2 left-2 px-2.5 py-1.5 shadow-sm">
                      ID verified
                    </Badge>
                  </Photo>

                  <PhoneMock
                    label={product.phonePhoto}
                    className="w-32 md:w-36"
                    alt={`${product.name} app screen`}
                  />

                  <Photo
                    src={product.accents[1].src}
                    alt={product.accents[1].alt}
                    ratio="3/4"
                    className="w-24 shrink-0 rotate-6 shadow-sm md:w-28"
                  >
                    <Badge className="absolute bottom-2 left-2 px-2.5 py-1.5 shadow-sm">
                      ID verified
                    </Badge>
                  </Photo>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5 md:p-7">
                <h3
                  className={cx(
                    "font-bold text-[length:var(--text-heading)]",
                    "leading-heading tracking-heading"
                  )}
                >
                  {product.name}
                </h3>

                <p className="mt-4 max-w-prose">{product.body}</p>

                {/* `mt-auto` pins the link to the bottom of whichever card
                    is taller, so the two links line up even when the two
                    descriptions do not run to the same number of lines. */}
                <Button variant="link" to={product.cta.to} className="mt-auto pt-6">
                  {product.cta.label}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
