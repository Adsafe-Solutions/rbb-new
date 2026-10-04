import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import Section from "../../components/Section/Section.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import GivingMethods from "../../components/GivingMethods/GivingMethods.jsx";
import DonationAction from "../../components/DonationAction/DonationAction.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import {
  DONATION,
  approvedDonationFaqs,
  approvedGivingMethods,
  donationActionBlock,
  donationState,
} from "../../content/index.js";

/* /get-involved/donate — the one donation page (Document 11), filled from
   content/donation.js:

         paper   PageHeader       invitation, state line, jump to the form
     —   ink     DonationAction   the action for the current state: the
                                  statement beside the donation form —
                                  Razorpay Checkout when live, its
                                  no-payment PREVIEW while pending. Right
                                  under the header, so on a phone the form
                                  is one short scroll away, not six
                                  sections down
     01  white   Why Give         the mission and vision, as a statement
     02  paper   ProgramIndex     the four program areas it supports
     03  white   GivingMethods    approved ways to give, or pending
     —   paper   TrustPanel       → /about#transparency
     04  white   Faq              approved answers, or pending
     05  paper   InvolvementPaths Volunteer / Partner / Fundraise
         accent  ClosingCta       the site-wide close

   The state (pending / approved-informational / approved-live) is decided
   in content/donation.js, never here: this page shows what it is told.

   ⚠ No payment form, amount, currency, provider, tax or receipt line
   written into this page — the form and everything in it come through
   DonationAction from content/donation.js and the server. The 78 / 12 / 10
   split is Transparency's, and stays there. */
export default function Donate() {
  const state = donationState();
  const action = donationActionBlock(state);
  const { hero, whyGive, supportAreas, ways, donationAction, trust, faq, relatedPaths, closingCta } = DONATION;
  const faqs = approvedDonationFaqs();
  const methods = approvedGivingMethods();
  /* Section numbers follow what is actually on the page. */
  const next = methods.length > 0 ? 4 : 3;

  return (
    <>
      <PageHeader
        title={hero.heading}
        parent={{ label: "Get Involved", to: "/get-involved" }}
        kicker={hero.kicker}
        aside={<IconPanel icons={["donate"]} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {hero.body}
        </p>
        {/* With the preview form on the page, its statement and badge say
            this already — a third time in the header was one too many. */}
        {state === "pending" && !action.preview && (
          <p className="type-note mt-8 max-w-[52ch] rounded-xl border-2 border-dashed border-edge bg-paper-white px-5 py-4 text-fg">
            {hero.notice}
          </p>
        )}
        <Button size="lg" to={hero.cta.to} className="mt-9">
          {hero.cta.labels[state]}
        </Button>
      </PageHeader>

      <DonationAction
        id={donationAction.id}
        kicker={donationAction.kicker}
        state={state}
        block={action}
      />

      <WhyGive index={1} {...whyGive} highlight="matters" />

      <ProgramIndex index={2} tone="paper" {...supportAreas} programs={supportAreas.items} />

      {/* Only once there is a way to give to list: while giving is
          pending the form above is the whole story, and a third "to be
          provided" panel on one page read as unfinished. */}
      {methods.length > 0 && (
        <GivingMethods index={3} tone="white" {...ways} methods={methods} live={state === "approved-live"} />
      )}

      <TrustPanel
        /* Between the program list (paper) and the questions (white) when
           there are no ways to give to list, so it takes the band's other
           colour; on paper only beside the white ways-to-give band. */
        tone={methods.length > 0 ? "paper" : "ink"}
        {...trust} links={DONATION.trustLinks} linkMeta={DONATION.trustLinkMeta} />

      {/* Questions only once RBB has approved answers — never an empty
          "to be provided" panel (content brief, 2026-10-04). */}
      {faqs.length > 0 && <Faq index={next} tone="white" heading={faq.heading} items={faqs} />}

      <InvolvementPaths index={faqs.length > 0 ? next + 1 : next} tone={faqs.length > 0 ? "paper" : "white"} {...relatedPaths} />

      <ClosingCta tone="accent" {...closingCta} />
    </>
  );
}

/* 01 — the case for giving, in RBB's own mission and vision: the
   heading beside the statement, the first paragraph as a pull-quote. */
function WhyGive({ id, index, kicker, heading, body, cta, highlight }) {
  const headingId = useId();

  return (
    <Section id={id} tone="white" pad="lg" aria-labelledby={headingId}>
      <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
        <div data-anim="sequence" className="lg:pt-12">
          {body.map((text, i) => (
            <p
              key={text}
              data-anim-item
              data-anim="soft"
              className={
                i === 0
                  ? "border-l-[6px] border-pop pl-6 text-[clamp(1.375rem,2.2vw,1.75rem)] font-bold leading-snug text-fg"
                  : "mt-6 max-w-[58ch] text-[19px] leading-relaxed text-copy"
              }
            >
              {text}
            </p>
          ))}
          <div data-anim-item data-anim="soft">
            <Button to={cta.to} variant="outline" className="mt-9">
              {cta.label}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
