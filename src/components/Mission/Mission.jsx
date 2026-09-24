import { cx } from "../../lib/cx.js";
import Badge from "../Badge/Badge.jsx";
import Button from "../Button/Button.jsx";
import Photo from "../Photo/Photo.jsx";
import Container from "../Container/Container.jsx";
/* Catalogue-only sample data (/components), imported directly rather than
   through content/index.js so it never enters the public build. */
import { MISSION } from "../../content/home.js";

/* The mission statement — the white section directly under the honey band.

   Two columns: the statement and its call to action on the left, a stack of
   overlapping interest cards on the right, each wearing a vertical pill
   label up its edge. The cards are a visual argument for the copy: the
   interests are what people actually match on.

   ⚠ The heading is left-aligned, as is every heading and paragraph on this
   site. The design centres display type in the hero and nothing else — a
   centred paragraph here would break the editorial column the whole page
   is built on. */
export default function Mission() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal">
            <h2
              className={cx(
                "max-w-[14ch] font-bold",
                "text-[length:var(--text-heading-lg)] leading-heading-lg",
                "tracking-heading-lg md:text-[length:clamp(3.5rem,5vw,4.5rem)]"
              )}
            >
              {MISSION.heading}
            </h2>

            <p className="mt-6 max-w-prose text-graphite">{MISSION.body}</p>

            <Button to={MISSION.cta.to} className="mt-8">
              {MISSION.cta.label}
            </Button>
          </div>

          {/* The card stack. A flex row with negative margins rather than
              absolute positioning: the cards then still push the row's
              height, so the section grows with them instead of needing a
              hard-coded container height that breaks at the next
              breakpoint. */}
          <div className="reveal flex justify-center lg:justify-end">
            {MISSION.cards.map((card, i) => (
              <div
                key={card.label}
                className={cx(
                  "relative w-[54%] max-w-[21rem] shrink-0",
                  /* Each card tucks behind the one before it. */
                  i > 0 && "-ml-[30%]",
                  i === 0 && "z-30",
                  i === 1 && "z-20",
                  i === 2 && "z-10"
                )}
                style={{ transform: `translateY(${card.y}px)` }}
              >
                <Photo src={card.src} alt={card.alt} ratio="3/4" className="shadow-sm">
                  {/* The label rides the card's right edge, half on and
                      half off, which is what stops the stack reading as a
                      flat collage. */}
                  <Badge
                    tone="honey"
                    vertical
                    className="absolute -right-3 top-6 shadow-sm"
                  >
                    {card.label}
                  </Badge>
                </Photo>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
