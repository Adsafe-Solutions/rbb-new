import { useId } from "react";
import Button from "../Button/Button.jsx";
import PosterCard from "../PosterCard/PosterCard.jsx";
import Section from "../Section/Section.jsx";

/* Two doorways side by side, each a poster pointing to a page of its own
   — on /impact, "Where we work" and "Our approach". Each poster is its
   own <section> with its own <h2>, so the page outline lists both; they
   share a row because each is a doorway, not a destination.

   One on Deep Trust Blue, one on Sky Blue — the same object in the two
   brand inks — and the second sits lower, so the pair reads as two
   posters pasted up rather than two columns.

   A teaser is { kicker, heading, body?, empty, cta }: `body` when RBB has
   supplied the summary, `empty` until then. */
function Teaser({ teaser, tone, tilt }) {
  const headingId = useId();

  return (
    <PosterCard as="section" aria-labelledby={headingId} tone={tone} tilt={tilt} kicker={teaser.kicker} className="flex min-w-0 flex-col">
      <h2 id={headingId} className="type-title">
        {teaser.heading}
      </h2>
      <p className="mt-5 max-w-[46ch] text-copy">{teaser.body ?? teaser.empty}</p>
      <Button variant="ink" to={teaser.cta.to} className="mt-8 self-start whitespace-normal! text-left">
        {teaser.cta.label}
      </Button>
    </PosterCard>
  );
}

export default function TeaserPair({ first, second, tone = "paper" }) {
  return (
    <Section tone={tone} pad="lg">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-10">
        <div className="reveal">
          <Teaser teaser={first} tone="ink" tilt="l" />
        </div>
        <div className="reveal lg:mt-16">
          <Teaser teaser={second} tone="accent" tilt="r" />
        </div>
      </div>
    </Section>
  );
}
