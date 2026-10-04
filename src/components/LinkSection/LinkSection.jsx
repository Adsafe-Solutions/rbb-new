import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import LinkChips from "../LinkChips/LinkChips.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A short section: a heading, then either a row of sticker links
   (`links`, drawn as LinkChips) with an optional button, or — with no
   links — a pending line (`empty`) on a pinned-up sheet.

   Used where a page needs to point onward (Stories → the program areas)
   or to say plainly that something is not available yet.

   `form` is a form config (content/forms.js). Once that form is ready it
   takes the pending line's place; until then the line stays. `surface`
   ("mist") is the old name for the paper band; `tone` sets it directly. */
export default function LinkSection({ index, kicker, heading, links = [], empty, cta, surface, tone, form }) {
  const pending = <EmptyPanel text={empty} cta={cta} className="reveal mt-12" />;
  const headingId = useId();

  return (
    <Section tone={tone ?? (surface === "mist" ? "paper" : "white")} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
      {links.length > 0 ? (
        <div className="reveal mt-12 flex flex-col items-start gap-10">
          <LinkChips items={links} align="start" />
          {cta && (
            <Button variant="outline" to={cta.to}>
              {cta.label}
            </Button>
          )}
        </div>
      ) : form ? (
        <FormShell config={form} fallback={pending} className="mt-12 max-w-xl" />
      ) : (
        pending
      )}
    </Section>
  );
}
