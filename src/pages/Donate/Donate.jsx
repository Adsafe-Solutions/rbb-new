import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import GivingMethods from "../../components/GivingMethods/GivingMethods.jsx";
import DonationAction from "../../components/DonationAction/DonationAction.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import {
  DONATION,
  approvedDonationFaqs,
  approvedGivingMethods,
  donationActionBlock,
  donationState,
} from "../../content/index.js";

/* /get-involved/donate — the one donation page (Document 11), filled from
   content/donation.js:

     01  mist band  PageHeader       invitation, state line, jump to 05
     02  white      Why Give         the mission and vision
     03  white      ProgramIndex     the four program areas it supports
     04  mist band  GivingMethods    approved ways to give, or pending
     05  white      DonationAction   the action for the current state
     06  white      TrustPanel       → /about/transparency
     07  mist band  Faq              approved answers, or pending
     08  white      InvolvementPaths Volunteer / Partner / Fundraise
     09  mist band  ClosingCta       the site-wide close

   The state (pending / approved-informational / approved-live) is decided
   in content/donation.js, never here: this page shows what it is told.

   ⚠ No payment form, amount, currency, provider, tax or receipt line on
   this page — see the header of content/donation.js. The 78 / 12 / 10
   split is Transparency's, and stays there. */
export default function Donate() {
  useReveal();
  const state = donationState();
  const { hero, whyGive, supportAreas, ways, donationAction, trust, faq, relatedPaths, closingCta } = DONATION;
  const faqs = approvedDonationFaqs();

  return (
    <>
      <PageHeader
        title={hero.heading}
        parent={{ label: "Get Involved", to: "/get-involved" }}
        kicker={hero.kicker}
        aside={<IconPanel icons={["donate"]} className="reveal" />}
      >
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {hero.body}
        </p>
        {state === "pending" && (
          <p className="mt-6 max-w-prose border-l-4 border-bumble-honey bg-paper-white py-4 pl-5 pr-6 font-medium text-bumble-ink">
            {hero.notice}
          </p>
        )}
        <Button to={hero.cta.to} className="mt-8">
          {hero.cta.labels[state]}
        </Button>
      </PageHeader>

      <WhyGive {...whyGive} />

      <ProgramIndex {...supportAreas} programs={supportAreas.items} />

      <GivingMethods {...ways} methods={approvedGivingMethods()} live={state === "approved-live"} />

      <DonationAction
        id={donationAction.id}
        kicker={donationAction.kicker}
        state={state}
        block={donationActionBlock(state)}
        className="pt-20 md:pt-28"
      />

      <TrustPanel {...trust} links={DONATION.trustLinks} linkMeta={DONATION.trustLinkMeta} />

      {faqs.length > 0 ? (
        <Faq heading={faq.heading} items={faqs} />
      ) : (
        <PendingFaq {...faq} />
      )}

      <div className="pt-20 md:pt-28">
        <InvolvementPaths {...relatedPaths} />
      </div>

      <ClosingCta {...closingCta} />
    </>
  );
}

/* 02 — the case for giving, in RBB's own mission and vision. No top
   border and no bottom padding: ProgramIndex follows on the same white
   ground and brings its own. */
function WhyGive({ id, kicker, heading, body, cta }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] pt-20 md:pt-28">
      <Container className="reveal grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <SectionHeading id={headingId} kicker={kicker} heading={heading} />
        <div className="lg:pt-10">
          {body.map((text) => (
            <p
              key={text}
              className="mt-4 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading first:mt-0"
            >
              {text}
            </p>
          ))}
          <Button to={cta.to} variant="outline" className="mt-8">
            {cta.label}
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* 07 — until RBB supplies answers: the heading, and the line saying they
   are to come. No sample questions. */
function PendingFaq({ id, kicker, heading, empty }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] bg-mist py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />
        <EmptyPanel text={empty} surface="mist" className="reveal mt-12 md:mt-14" />
      </Container>
    </section>
  );
}
