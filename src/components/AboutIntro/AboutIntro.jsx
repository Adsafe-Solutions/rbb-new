import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import Picture from "../Picture/Picture.jsx";

/* Who we are: the statement and its three principles on the left, a
   photograph with the registration pinned to it on the right.

   The registration is a CREDENTIAL CARD over the photograph's corner, not
   a sentence in the paragraph. It is the one line of this section a
   sceptical donor is actually looking for, and set as the first of three
   centred sentences — as it used to be — it read as filler.

   The photograph takes the brand swoop on its top-left corner, facing the
   copy, and the card sits on the opposite corner so the two never fight
   over the same edge. Left-aligned throughout: every paragraph on this
   site is, and the version this replaced was the odd one out.

   `imageFirst` puts the photograph first — above the copy on a phone, to
   its left from `lg` — and turns the swoop to face the copy from that
   side. The homepage's "Who we are" uses it; /about does not. `focal` is
   the photograph's object-position. Pillars and credential are optional:
   neither renders without content.

   The kicker is Deep Trust Blue behind a Sky Blue rule. It was Sky Blue
   type, which on white is about 2.6:1 — under what 16px text needs. */
export default function AboutIntro({
  kicker,
  heading,
  body,
  pillars = [],
  credential,
  cta,
  src,
  alt,
  focal,
  imageFirst = false,
}) {
  return (
    <section className="py-20 md:py-28">
      <Container
        className={cx(
          "grid items-center gap-12 lg:gap-20",
          imageFirst ? "lg:grid-cols-[5fr_6fr]" : "lg:grid-cols-[6fr_5fr]"
        )}
      >
        <div className="reveal">
          <p className="flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
            <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
            {kicker}
          </p>
          <h2 className="mt-4 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading md:text-[length:var(--text-heading-lg)] md:leading-heading-lg md:tracking-heading-lg">
            {heading}
          </h2>

          {body.map((text) => (
            <p key={text} className="mt-5 max-w-prose text-graphite">
              {text}
            </p>
          ))}

          {/* The three principles, each under the short Sky Blue rule the
              FeatureGrid promise cards use — one mark for "a promise"
              wherever it appears on the site. */}
          {pillars.length > 0 && (
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <li key={pillar.title}>
                  <h3 className="border-l-4 border-bumble-honey pl-3 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                    {pillar.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" to={cta.to} className="mt-10">
            {cta.label}
          </Button>
        </div>

        <div className={cx("reveal relative", imageFirst && "order-first")}>
          <div
            className={cx(
              "overflow-hidden rounded-3xl shadow-sm",
              /* First on a phone, a 4:5 portrait is most of a screen of
                 picture before any words — so it is landscape until the
                 copy sits beside it. */
              imageFirst
                ? "aspect-[4/3] rounded-tr-[5rem] lg:aspect-[4/5] lg:rounded-tr-[8rem]"
                : "aspect-[4/5] rounded-tl-[8rem]"
            )}
          >
            <Picture
              sizes="(min-width: 1024px) 40vw, 100vw"
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              style={focal ? { objectPosition: focal } : undefined}
              className="h-full w-full object-cover"
            />
          </div>

          {/* The registration card pinned to the photograph — only with a
              registration RBB has confirmed. */}
          {credential && (
            <div className="absolute -bottom-6 left-4 flex items-center gap-4 rounded-3xl bg-paper-white p-5 pr-7 shadow-sm md:-left-8">
              <Mark className="h-11 w-11 shrink-0 text-bumble-honey" />
              <div>
                <p className="text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                  {credential.label}
                </p>
                <p className="font-bold text-trust-blue">{credential.value}</p>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
