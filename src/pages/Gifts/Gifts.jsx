import BannerHero from "../../components/BannerHero/BannerHero.jsx";
import SplitFeature from "../../components/SplitFeature/SplitFeature.jsx";
import OptionStrip from "../../components/OptionStrip/OptionStrip.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { GIFTS } from "../../content/index.js";

/* /gifts — Major Giving, in the order the reference stacks it:

     photo hero   BannerHero     "Major Giving"
     white        SplitFeature   Create a Lasting Legacy
     white        SplitFeature   100% Feedback Promise (flipped)
     mist band    OptionStrip    three water projects
     white        OptionStrip    four livelihoods items — scrolls
     mist band    OptionStrip    three health projects
     white        SplitFeature   Zakat-Eligible (flipped)
     white        Newsletter     stay tuned */
export default function Gifts() {
  useReveal();

  return (
    <>
      <BannerHero {...GIFTS.hero} />
      <SplitFeature {...GIFTS.legacy} />
      <SplitFeature {...GIFTS.feedback} />
      <OptionStrip {...GIFTS.water} />
      <OptionStrip {...GIFTS.empowerment} />
      <OptionStrip {...GIFTS.health} />
      <SplitFeature {...GIFTS.zakat} />
      <Newsletter {...GIFTS.newsletter} />
    </>
  );
}
