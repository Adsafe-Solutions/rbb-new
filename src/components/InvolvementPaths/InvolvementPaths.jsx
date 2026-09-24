import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The ways to take part, side by side. One item may be `featured` —
   Donate, on the homepage — and it alone is set on Deep Trust Blue, with
   the white `inverse` button. The rest are Light Gray with an outline
   button, so the row is cohesive without every card being the same card.

   ⚠ Not the green `solid` button on the blue card: `solid` turns Deep
   Trust Blue on hover, and on this card that is a button disappearing
   under the pointer.

   No top padding: on the homepage it follows TrustPanel, another white
   section, whose bottom padding is the gap between them.

   Items are { title, description, cta, to, icon, featured? }. Removing an
   entry reflows the grid — the Fundraise path in particular is waiting on
   RBB to confirm it is offered (content/homepage.js). */
export default function InvolvementPaths({ kicker, heading, items }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="pb-20 md:pb-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        <ul
          className={cx(
            "reveal mt-12 grid gap-cards sm:grid-cols-2 md:mt-14",
            items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
          )}
        >
          {items.map((item) => (
            <li
              key={item.to}
              className={cx(
                "flex flex-col rounded-3xl p-7 md:p-8",
                item.featured ? "rounded-tr-[3rem] bg-trust-blue text-paper-white" : "bg-mist"
              )}
            >
              <span
                className={cx(
                  "flex h-12 w-12 items-center justify-center rounded-2xl",
                  item.featured ? "bg-paper-white/15 text-paper-white" : "bg-paper-white text-trust-blue"
                )}
              >
                <LineIcon name={item.icon} />
              </span>
              <h3
                className={cx(
                  "mt-8 font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm",
                  item.featured && "text-paper-white"
                )}
              >
                {item.title}
              </h3>
              <p className={cx("mt-2 flex-1", item.featured ? "text-paper-white/85" : "text-graphite")}>
                {item.description}
              </p>
              <Button
                to={item.to}
                size="sm"
                variant={item.featured ? "inverse" : "outline"}
                className="mt-8 self-start"
              >
                {item.cta}
              </Button>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
