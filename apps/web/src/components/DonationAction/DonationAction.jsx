import { useId } from "react";
import Button from "../Button/Button.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import Section from "../Section/Section.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";

/* A giving statement band — Deep Trust Blue, a heading, a line or two
   and the way on. Used by the LEGACY giving addresses (/giving, /gifts,
   /giving/major-giving), which are not donation pages of their own: they
   point to the one donation page with `onward`.

   ⚠ No form here. Every page that takes a gift is the shared donation
   page (components/DonationExperience), and every gift goes through the
   one form (components/DonationForm). Drawing a form in this band was a
   second route to the same form, and it is gone.

   `state` comes from `donationState()` in content/donation.js; `block` is
   that state's copy. With giving live through an external provider page,
   the band links to it. `className` is accepted for the pages that still
   pass spacing. */
export default function DonationAction({ id, kicker, state, block, onward, tone = "ink" }) {
  const headingId = useId();
  const body = block.body ?? [];
  const live = state === "approved-live";

  return (
    <Section id={id} tone={tone} pad="lg" watermark="right" aria-labelledby={headingId}>
      <div className="reveal">
        <MarkStamp className="h-16 w-16 -rotate-6" />
        {kicker && <SectionKicker className="mt-8">{kicker}</SectionKicker>}
        <h2 id={headingId} className="type-title mt-5 max-w-[18ch]">
          {block.heading}
        </h2>
        {body.map((text) => (
          <p key={text} className="type-lead mt-6 max-w-[48ch] text-copy">
            {text}
          </p>
        ))}

        {live && block.url && (
          <Button href={block.url} size="lg" rel="noopener noreferrer" className="mt-9 whitespace-normal!">
            {block.label}
          </Button>
        )}

        {(block.cta || onward) && (
          <div className="mt-10 border-t-2 border-hair pt-8">
            {block.ctaIntro && <p className="max-w-[54ch] text-copy">{block.ctaIntro}</p>}
            <div className="mt-6 flex flex-wrap gap-4">
              {onward && (
                <Button to={onward.to} className="whitespace-normal!">
                  {onward.label}
                </Button>
              )}
              {block.cta && (
                <Button to={block.cta.to} variant={onward ? "outline" : "ink"} className="whitespace-normal!">
                  {block.cta.label}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
