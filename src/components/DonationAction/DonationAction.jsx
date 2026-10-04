import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import Section from "../Section/Section.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";
import DonationCheckout from "../DonationCheckout/DonationCheckout.jsx";
import { DONATIONS_IN_BUILD } from "../../config/env.js";

/* The donation action (Document 11) — the one place a visitor is told
   whether, and how, they can give. A Deep Trust Blue band, so it is the
   thing on the page that reads as "the action", in every state:

     pending                 what is happening, that nothing here takes a
                             payment, and where questions go
     approved-informational  RBB's approved giving information, no button
                             to pay
     approved-live           RBB's verified provider page, as a link out —
                             or, with `block.checkout`, Razorpay Checkout on
                             the page (Document 22, DonationCheckout): an
                             amount and a name/email here, printed as three
                             numbered step cards, and the payment itself in
                             Razorpay's own window

   While giving is pending, `block.preview` carries the same checkout as a
   PREVIEW (content/donation.js `donationPreview`): the form beside the
   "not open yet" statement, with placeholder amounts, taking no payment
   and making no request. Same layout as the live checkout — the
   statement on the left, the white card on the right; stacked on a
   phone, statement first and the form directly under it.

   `state` comes from `donationState()` in content/donation.js, which only
   reports a state its approved content supports. `block` is that state's
   copy. `onward` is an extra route (the legacy pages point at the
   canonical donation page with it).

   The heading column is sticky beside the checkout on desktop, so the
   statement of what this is stays in view while the steps are filled in.
   No amount or form of its own; the checkout's come from the server.
   Never a countdown, never urgency. `className` is accepted for the pages
   that still pass spacing. */
export default function DonationAction({ id, kicker, state, block, onward, tone = "ink" }) {
  const headingId = useId();
  const body = block.body ?? [];
  const live = state === "approved-live";
  const checkout = DONATIONS_IN_BUILD && live && block.checkout;
  const preview = !live && block.preview;
  const form = checkout || preview;

  return (
    <Section id={id} tone={tone} pad="lg" watermark="right" aria-labelledby={headingId}>
      <div className={cx(form && "grid gap-10 lg:grid-cols-[5fr_6fr] lg:gap-16")}>
        <div className={cx("reveal", form && "lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start")}>
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

          {live && !block.checkout && (
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

        {form && (
          /* Narrow on purpose: a donation is a short, focused form — at
             full column width the amount tiles become a spreadsheet. */
          <div className="mx-auto w-full min-w-0 max-w-xl lg:mx-0">
            {checkout ? <DonationCheckout copy={block} /> : <DonationCheckout copy={preview.copy} preview={preview} />}
          </div>
        )}
      </div>
    </Section>
  );
}
