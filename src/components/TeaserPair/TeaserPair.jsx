import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Two short sections side by side, each pointing to a page of its own —
   on /impact, "Where we work" and "Our approach". Each panel is its own
   <section> with its own <h2>, so the page outline lists both; they share
   a row because each is a doorway, not a destination.

   A teaser is { kicker, heading, body?, empty, cta }: `body` when RBB has
   supplied the summary, `empty` until then. The first panel sits on Deep
   Trust Blue, the second on Light Gray. */
function Teaser({ teaser, tone }) {
  const headingId = useId();
  const blue = tone === "blue";

  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        /* `min-w-0`: a grid item will not shrink below its content by
           default, and on a 320px phone that content includes a button. */
        "reveal flex min-w-0 flex-col rounded-3xl p-6 sm:p-10 md:p-12",
        blue ? "rounded-tl-[5rem] bg-trust-blue" : "rounded-br-[5rem] bg-mist"
      )}
    >
      <SectionHeading
        id={headingId}
        kicker={teaser.kicker}
        heading={teaser.heading}
        tone={blue ? "invert" : "default"}
      />
      <p className={cx("mt-5 flex-1 text-[length:var(--text-body)]", blue ? "text-paper-white/85" : "text-graphite")}>
        {teaser.body ?? teaser.empty}
      </p>
      <Button
        variant={blue ? "inverse" : "outline"}
        to={teaser.cta.to}
        /* Allowed to wrap: the site's buttons are nowrap, and "Explore
           Where We Work" is wider than this panel on the narrowest phones. */
        className="mt-8 self-start whitespace-normal! text-center"
      >
        {teaser.cta.label}
      </Button>
    </section>
  );
}

export default function TeaserPair({ first, second }) {
  return (
    <div className="py-20 md:py-28">
      <Container className="grid gap-cards lg:grid-cols-2">
        <Teaser teaser={first} tone="blue" />
        <Teaser teaser={second} tone="mist" />
      </Container>
    </div>
  );
}
