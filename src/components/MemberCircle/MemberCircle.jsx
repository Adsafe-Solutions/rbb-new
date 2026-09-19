import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Photo from "../Photo/Photo.jsx";
import Seal from "../Seal/Seal.jsx";
import Container from "../Container/Container.jsx";
import { MEMBER_CIRCLE } from "../../content/index.js";

/* The Member Circle card — photo left, copy right, on the soft mist
   surface.

   This is the design's "quiet elevation" case: the card steps forward from
   the white page using tone alone (#f3f3f3) with NO shadow. The shadow is
   reserved for white cards that need to lift off white; a mist card
   already reads as raised and adding the shadow to it makes the section
   look heavier than anything around it. */
export default function MemberCircle() {
  return (
    <section className="pb-16 md:pb-24">
      <Container>
        <div
          className={cx(
            "reveal grid items-center gap-8 rounded-3xl bg-mist p-6",
            "md:grid-cols-2 md:gap-12 md:p-10"
          )}
        >
          <div className="relative">
            <Photo src={MEMBER_CIRCLE.src} ratio="1/1" alt={MEMBER_CIRCLE.alt} />
            {/* The seal breaks the photo's bottom-left corner. Overlapping
                the edge rather than sitting inside it is what makes it read
                as a stamp applied to the picture. */}
            <Seal
              label={MEMBER_CIRCLE.sealLabel}
              className="absolute -bottom-6 left-6 h-28 w-28 md:h-36 md:w-36"
            />
          </div>

          <div className="pt-8 md:pt-0">
            <h2
              className={cx(
                "font-bold text-[length:var(--text-heading)]",
                "leading-heading tracking-heading md:text-[length:var(--text-heading-lg)]",
                "md:leading-heading-lg md:tracking-heading-lg"
              )}
            >
              {MEMBER_CIRCLE.heading}
            </h2>

            {MEMBER_CIRCLE.paragraphs.map((text) => (
              <p key={text} className="mt-5 max-w-prose text-graphite">
                {text}
              </p>
            ))}

            <Button to={MEMBER_CIRCLE.cta.to} className="mt-8">
              {MEMBER_CIRCLE.cta.label}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
