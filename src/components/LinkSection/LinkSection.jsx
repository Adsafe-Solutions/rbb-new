import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import LinkChips from "../LinkChips/LinkChips.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A short section: a heading, then either a row of links (`links`, drawn
   as LinkChips) with an optional button, or — with no links — a pending
   line (`empty`) in the shared empty panel.

   Used where a page needs to point onward (Stories → the program areas)
   or to say plainly that something is not available yet (the newsletter
   slot, which has no form until RBB approves a provider).

   `form` is a form config (content/forms.js). Once that form is ready it
   takes the pending line's place; until then the line stays. */
export default function LinkSection({ kicker, heading, links = [], empty, cta, surface = "paper", form }) {
  const pending = <EmptyPanel text={empty} cta={cta} surface={surface} className="reveal mt-10" />;

  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cx("py-20 md:py-28", surface === "mist" && "bg-mist")}>
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />
        {links.length > 0 ? (
          <div className="reveal mt-10 flex flex-col items-start gap-8">
            <LinkChips items={links} align="start" surface={surface} />
            {cta && (
              <Button variant="outline" to={cta.to}>
                {cta.label}
              </Button>
            )}
          </div>
        ) : form ? (
          <FormShell config={form} fallback={pending} className="mt-10 max-w-xl" />
        ) : (
          pending
        )}
      </Container>
    </section>
  );
}
