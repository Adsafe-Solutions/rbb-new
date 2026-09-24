import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Ways to Give (Document 11) — the giving methods RBB has approved, one
   card each, on a Light Gray band. With none, the pending line stands in
   their place: no example methods, no "card, bank transfer or cheque"
   filler that would read as an offer.

   `methods` are already filtered to approved ones (content/donation.js).
   A method's own link shows only when `live` — on an informational page
   the card describes how to give; it does not send anyone to pay. */
export default function GivingMethods({ id, kicker, heading, empty, linkLabel, methods, live = false }) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[var(--header-h)] bg-mist py-20 md:py-28"
    >
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        {methods.length === 0 ? (
          <EmptyPanel text={empty} surface="mist" className="reveal mt-12 md:mt-14" />
        ) : (
          <ul className="reveal mt-12 grid gap-cards sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
            {methods.map((method) => (
              <li key={method.id} className="flex flex-col rounded-3xl bg-paper-white p-7 md:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bumble-honey/12 text-trust-blue">
                  <LineIcon name="donate" />
                </span>
                <h3 className="mt-8 font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm">
                  {method.label}
                </h3>
                {method.description && <p className="mt-2 text-graphite">{method.description}</p>}
                {method.instructions?.length > 0 && (
                  <ol className="mt-5 grid list-decimal gap-2 pl-5 text-bumble-ink">
                    {method.instructions.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {method.availability && (
                  <p className="mt-5 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                    {method.availability}
                  </p>
                )}
                {live && method.externalUrl && (
                  <div className="mt-auto pt-8">
                    <Button
                      href={method.externalUrl}
                      size="sm"
                      rel="noopener noreferrer"
                      className="whitespace-normal!"
                    >
                      {method.provider ? `${linkLabel} ${method.provider}` : method.label}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
