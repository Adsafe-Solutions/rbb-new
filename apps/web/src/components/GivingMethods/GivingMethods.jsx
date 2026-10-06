import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import FlyerCard from "../FlyerCard/FlyerCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Ways to Give (Document 11) — the giving methods RBB has approved, one
   flyer each. With none, the pending line stands in their place: no
   example methods, no "card, bank transfer or cheque" filler that would
   read as an offer.

   `methods` are already filtered to approved ones (content/donation.js).
   A method's own link shows only when `live` — on an informational page
   the card describes how to give; it does not send anyone to pay. */
export default function GivingMethods({ id, index, kicker, heading, empty, linkLabel, methods, live = false, tone = "paper" }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />

      {methods.length === 0 ? (
        <EmptyPanel text={empty} className="reveal mt-14" />
      ) : (
        <ul data-anim-stagger className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map((method) => (
            <li key={method.id}>
              <FlyerCard
                as="div"
                icon="donate"
                title={method.label}
                footer={
                  live && method.externalUrl ? (
                    <div className="mt-auto pt-8">
                      <Button href={method.externalUrl} size="sm" rel="noopener noreferrer" className="whitespace-normal!">
                        {method.provider ? `${linkLabel} ${method.provider}` : method.label}
                      </Button>
                    </div>
                  ) : null
                }
              >
                {method.description && <p>{method.description}</p>}
                {method.instructions?.length > 0 && (
                  <ol className="mt-4 grid list-decimal gap-2 pl-5 text-copy">
                    {method.instructions.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {method.availability && <p className="type-meta mt-4">{method.availability}</p>}
              </FlyerCard>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
