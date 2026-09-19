import Hero from "../../components/Hero/Hero.jsx";
import HeroBleed from "../../components/HeroBleed/HeroBleed.jsx";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner.jsx";
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
     honey banner   FeatureBanner  the programme lead, photo + panel
     mist band      ImpactStats    four figures, the first highlighted
     white          DonateWidget   the appeal form beside a photograph
     white          CampaignHero   investigation lead with the swooped photo
     ink card       ActionCard     the petition
     ink card       GetInvolved    volunteer / events / fundraise tabs
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
      <FeatureBanner {...NGO.work} />
      <ImpactStats {...NGO.appealStats} />
      <DonateWidget {...NGO.donate} />
      <CampaignHero {...NGO.campaign} />
      <ActionCard {...NGO.action} />
      <GetInvolved {...NGO.getInvolved} />
      <ImpactMosaic {...NGO.mosaic} />
      <FeatureBanner {...NGO.resources} />
      <FeatureBanner {...NGO.about} />
      <ImpactStats {...NGO.overallStats} surface="paper" />
    </>
  );
}
