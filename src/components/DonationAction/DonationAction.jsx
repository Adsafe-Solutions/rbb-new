import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import Mark from "../Mark/Mark.jsx";
import DonationCheckout from "../DonationCheckout/DonationCheckout.jsx";
import { DONATIONS_IN_BUILD } from "../../config/env.js";

/* The donation action (Document 11) — the one place a visitor is told
   whether, and how, they can give. A single Deep Trust Blue panel, so it
   is the thing on the page that reads as "the action", in every state:

     pending                 what is happening, that nothing here takes a
                             payment, and where questions go
     approved-informational  RBB's approved giving information, no button
                             to pay
     approved-live           RBB's verified provider page, as a link out —
                             the site never collects payment details itself
                             — or, with `block.checkout`, Razorpay Checkout
                             on the page (Document 22, DonationCheckout):
                             an amount and a name/email here, the payment
                             itself in Razorpay's own window

   `state` comes from `donationState()` in content/donation.js, which only
   reports a state its approved content supports. `block` is that state's
   copy. `onward` is an extra route (the legacy pages point at the
   canonical donation page with it).

   No amount or form of its own; the checkout's come from the server.
   Never a countdown. The white `inverse`
   button, not green: `solid` turns Deep Trust Blue on hover, which on
   this panel is a button vanishing under the pointer. */
export default function DonationAction({ id, kicker, state, block, onward, className = "" }) {
  const headingId = useId();
  const body = block.body ?? [];
  const live = state === "approved-live";

  return (
    <section id={id} aria-labelledby={headingId} className={`scroll-mt-[var(--header-h)] ${className}`}>
      <Container>
        <div className="reveal relative overflow-hidden rounded-3xl rounded-tr-[5rem] bg-trust-blue p-7 text-paper-white sm:p-10 md:p-14">
          <Mark
            className="pointer-events-none absolute -bottom-12 -right-12 text-paper-white/10"
            style={{ width: "14rem", height: "14rem" }}
          />
          <div className="relative grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-white/15"
            >
              <LineIcon name="donate" className="h-8 w-8" />
            </span>

            <div className="min-w-0">
              {kicker && (
                <p className="flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-paper-white/85">
                  <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
                  {kicker}
                </p>
              )}
              <h2
                id={headingId}
                className="mt-4 font-bold text-[length:var(--text-heading)] leading-heading tracking-heading text-paper-white md:text-[length:var(--text-heading-lg)] md:leading-heading-lg md:tracking-heading-lg"
              >
                {block.heading}
              </h2>
              {body.map((text) => (
                <p
                  key={text}
                  className="mt-4 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-paper-white/85"
                >
                  {text}
                </p>
              ))}

              {DONATIONS_IN_BUILD && live && block.checkout && <DonationCheckout copy={block} />}

              {live && !block.checkout && (
                <Button href={block.url} variant="inverse" rel="noopener noreferrer" className="mt-8 whitespace-normal!">
                  {block.label}
                </Button>
              )}

              {(block.cta || onward) && (
                <div className="mt-8 border-t border-paper-white/20 pt-8">
                  {block.ctaIntro && <p className="max-w-prose text-paper-white/85">{block.ctaIntro}</p>}
                  <div className="mt-5 flex flex-wrap gap-4">
                    {onward && (
                      <Button to={onward.to} variant="inverse" className="whitespace-normal!">
                        {onward.label}
                      </Button>
                    )}
                    {block.cta && (
                      <Button
                        to={block.cta.to}
                        variant={onward ? "outlineInverse" : "inverse"}
                        className="whitespace-normal!"
                      >
                        {block.cta.label}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
