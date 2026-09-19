import Hero from "../../components/Hero/Hero.jsx";
import HeroBleed from "../../components/HeroBleed/HeroBleed.jsx";
import AccountabilityBand from "../../components/AccountabilityBand/AccountabilityBand.jsx";
import AboutIntro from "../../components/AboutIntro/AboutIntro.jsx";
import FightFor from "../../components/FightFor/FightFor.jsx";
import AppealSpotlight from "../../components/AppealSpotlight/AppealSpotlight.jsx";
import LegacyCollage from "../../components/LegacyCollage/LegacyCollage.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import DonateWidget from "../../components/DonateWidget/DonateWidget.jsx";
import CampaignHero from "../../components/CampaignHero/CampaignHero.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import ImpactMosaic from "../../components/ImpactMosaic/ImpactMosaic.jsx";
import useReveal from "../../hooks/useReveal.js";
import { SECTIONS } from "../../config/sections.js";
import { NGO } from "../../content/index.js";

/* The homepage, in the order the page stacks it:

     hero           HeroBleed      the rotating photograph, copy on white
                                   (or Hero, the logo-framed one — the
                                   switch is SECTIONS.homeHero)
     white          AppealSpotlight the live Gaza appeal, compact — first
                                   thing after the hero, because it is the
                                   thing happening now
     mist band      FightFor       what we fight for — photo + card
     white          DonateWidget   the Gaza form (the spotlight's
                                   "Donate to Gaza" jumps here)
     white          CampaignHero   Sudan — copy left, swooped photo right
     white          CampaignHero   Yemen — the same, flipped (photo left),
                                   so the two appeals zigzag as a pair
     ink card       GetInvolved    volunteer / events / fundraise tabs
     mist band      LegacyCollage  thirty years in one sentence, beside a
                                   three-photo collage — the claim, just
                                   before the mosaic that backs it up
     honey band     ImpactMosaic   stats and photos in three columns
     blue band      AccountabilityBand  reports: the commitments beside the
                                        documents that back them
     white          AboutIntro     who we are — principles, and the
                                   registration pinned to the photograph
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
      <AppealSpotlight {...NGO.gaza} />
      <FightFor {...NGO.fightFor} />
      {/* The spotlight's "Donate to Gaza" button jumps here. The widget
          stays below FightFor rather than following the spotlight up the
          page: a full donation form straight after the hero would make the
          top of the page heavier, and the jump works across any distance.
          `scroll-mt` because the header is fixed — without it the jump
          lands with the widget's top under the header. */}
      <div id="donate-gaza" className="scroll-mt-[var(--header-h)]">
        <DonateWidget {...NGO.donate} />
      </div>
      <CampaignHero {...NGO.campaign} />
      <CampaignHero {...NGO.yemen} flip joined />
      <GetInvolved {...NGO.getInvolved} />
      <LegacyCollage {...NGO.legacy} />
      <ImpactMosaic {...NGO.mosaic} />
      <AccountabilityBand {...NGO.accountability} />
      <AboutIntro {...NGO.about} />
      <ImpactStats {...NGO.overallStats} surface="paper" />
    </>
  );
}
