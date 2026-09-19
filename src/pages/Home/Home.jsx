import Hero from "../../components/Hero/Hero.jsx";
import HeroBleed from "../../components/HeroBleed/HeroBleed.jsx";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner.jsx";
import FightFor from "../../components/FightFor/FightFor.jsx";
import AppealSpotlight from "../../components/AppealSpotlight/AppealSpotlight.jsx";
import LegacyCollage from "../../components/LegacyCollage/LegacyCollage.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import DonateWidget from "../../components/DonateWidget/DonateWidget.jsx";
import CampaignHero from "../../components/CampaignHero/CampaignHero.jsx";
import ActionCard from "../../components/ActionCard/ActionCard.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import ImpactMosaic from "../../components/ImpactMosaic/ImpactMosaic.jsx";
import useReveal from "../../hooks/useReveal.js";
import { SECTIONS } from "../../config/sections.js";
import { NGO } from "../../content/index.js";

/* The homepage, in the order the page stacks it:

     hero           HeroBleed      the rotating photograph, copy on white
                                   (or Hero, the logo-framed one — the
                                   switch is SECTIONS.homeHero)
     mist band      FightFor       what we fight for — photo + card
     white          AppealSpotlight the Gaza appeal — photo, story, four
                                   figures and the way to give, in one card
     white          DonateWidget   the appeal form (the spotlight's
                                   "Donate to Gaza" jumps here)
     white          CampaignHero   investigation lead with the swooped photo
     ink card       ActionCard     the petition
     ink card       GetInvolved    volunteer / events / fundraise tabs
     mist band      LegacyCollage  thirty years in one sentence, beside a
                                   three-photo collage — the claim, just
                                   before the mosaic that backs it up
     honey band     ImpactMosaic   stats and photos in three columns
     honey banner   FeatureBanner  resources
     pollen banner  FeatureBanner  about
     white          ImpactStats    three lifetime figures

   The alternation is the point — full-bleed yellow, then contained white,
   is the punctuation the whole page is built on. Reordering these changes
   the rhythm, not just the sequence.

   Every section below the hero carries `.reveal`; useReveal() is what
   lets them fade in — without it they all sit at opacity 0. */
export default function Home() {
  useReveal();

  return (
    <>
      {SECTIONS.homeHero === "bleed" ? <HeroBleed /> : <Hero />}
      <FightFor {...NGO.fightFor} />
      <AppealSpotlight {...NGO.gaza} />
      {/* The spotlight's "Donate to Gaza" button jumps here — the widget
          for the same appeal, directly below. `scroll-mt` because the
          header is fixed: without it the jump lands with the widget's top
          under the header. */}
      <div id="donate-gaza" className="scroll-mt-[var(--header-h)]">
        <DonateWidget {...NGO.donate} />
      </div>
      <CampaignHero {...NGO.campaign} />
      <ActionCard {...NGO.action} />
      <GetInvolved {...NGO.getInvolved} />
      <LegacyCollage {...NGO.legacy} />
      <ImpactMosaic {...NGO.mosaic} />
      <FeatureBanner {...NGO.resources} />
      <FeatureBanner {...NGO.about} />
      <ImpactStats {...NGO.overallStats} surface="paper" />
    </>
  );
}
