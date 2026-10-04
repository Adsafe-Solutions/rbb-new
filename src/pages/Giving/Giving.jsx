import PageHero from "../../components/PageHero/PageHero.jsx";
import DonationAction from "../../components/DonationAction/DonationAction.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import { DONATION, GIVING, donationState, legacyGivingBlock } from "../../content/index.js";

/* /giving — a legacy address, kept so old links land (Document 11):

     mist band    PageHero        heading, line, → /get-involved/donate
     white        DonationAction  the current giving state, → Donate
     white        Newsletter      stay informed

   It offers no giving routes of its own; see content/giving.js for why
   the six it used to list are gone. */
export default function Giving() {

  return (
    <>
      <PageHero {...GIVING.hero} />
      <DonationAction
        kicker={DONATION.legacy.kicker}
        state={donationState()}
        block={legacyGivingBlock()}
        onward={DONATION.legacy.onward}
        className="pt-20 md:pt-28"
      />
      <Newsletter {...GIVING.newsletter} />
    </>
  );
}
