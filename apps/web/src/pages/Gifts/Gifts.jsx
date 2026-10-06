import BannerHero from "../../components/BannerHero/BannerHero.jsx";
import DonationAction from "../../components/DonationAction/DonationAction.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import { DONATION, GIFTS, donationState, legacyGivingBlock } from "../../content/index.js";

/* /gifts and /giving/major-giving — legacy addresses, kept so old links
   land (Document 11):

     photo hero   BannerHero      "Major Giving" and its placeholder
     white        DonationAction  the current giving state, → Donate
     white        Newsletter      stay tuned

   The catalogue sections it used to stack named giving programs RBB has
   not supplied; see content/gifts.js. */
export default function Gifts() {

  return (
    <>
      <BannerHero {...GIFTS.hero} />
      <DonationAction
        kicker={DONATION.legacy.kicker}
        state={donationState()}
        block={legacyGivingBlock()}
        onward={DONATION.legacy.onward}
        className="pt-20 md:pt-28"
      />
      <Newsletter {...GIFTS.newsletter} />
    </>
  );
}
