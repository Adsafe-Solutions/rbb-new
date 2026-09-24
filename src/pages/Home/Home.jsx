import HeroBleed from "../../components/HeroBleed/HeroBleed.jsx";
import LegacyCollage from "../../components/LegacyCollage/LegacyCollage.jsx";
import ProgramAreas from "../../components/ProgramAreas/ProgramAreas.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProjectTimeline from "../../components/ProjectTimeline/ProjectTimeline.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import RegularGiving from "../../components/RegularGiving/RegularGiving.jsx";
import useReveal from "../../hooks/useReveal.js";
import { HOMEPAGE } from "../../content/index.js";

/* The homepage — Document 02, in its section order. Each section answers
   one question, and the page reads top to bottom as: who we are → what we
   do → how we work → what it achieves → the evidence → why trust us → how
   to take part.

     01  blue band   HeroBleed         headline, two ways in, photograph
     02  mist band   LegacyCollage     who we are — three-photo collage
     03  mist band   ProgramAreas      the four program areas
     04  white       ApproachFlow      Listen → Partner → Act → Sustain
     05  mist band   ImpactStats       headline figures on branded cards
     06  mist band   ProjectTimeline   the projects, a row that moves with the
                                       scroll over a timeline
     07  mist band   StoriesOfChange   lead story + two, magazine layout
     08  white       TrustPanel        one quiet panel → Transparency
     09  white       GetInvolved       the four paths, as tabs
     10  white       RegularGiving     the closing invitation, blue card

   02, 05, 06, 09 and 10 are the design-catalogue sections promoted into
   the page, replacing AboutIntro, ImpactMetrics, FeaturedWork,
   InvolvementPaths and ClosingCta. Their copy is RBB's (content/homepage.js); the legacy
   claims they were drawn with ("since 1993", "30+ years", other
   charities' figures, a monthly-giving ask) are not carried over.

   The alternation of ground is the page's rhythm; no two neighbouring
   sections share a layout. Every string comes from content/homepage.js.

   What used to be here — appeal spotlight, donate form, two country
   campaigns, collage, mosaic, accountability band, lifetime stats,
   monthly-giving card — is gone from the page, not hidden. Those
   components are still in the codebase (and in /components) for the inner
   pages that will need them.

   Every section below the hero carries `.reveal`; useReveal() is what
   lets them fade in — without it they sit at opacity 0. */
export default function Home() {
  useReveal();
  const { hero, whoWeAre, programs, approach, impact, featuredWork, stories, transparency, getInvolved, finalCta } =
    HOMEPAGE;

  return (
    <>
      <HeroBleed {...hero} />
      <LegacyCollage
        headline={whoWeAre.collage.headline}
        headlineAccent={whoWeAre.collage.headlineAccent}
        body={whoWeAre.body}
        cta={whoWeAre.cta}
        secondary={whoWeAre.collage.secondary}
        photos={whoWeAre.collage.photos}
      />
      <ProgramAreas {...programs} />
      <ApproachFlow {...approach} />
      <ImpactStats
        kicker={impact.kicker}
        heading={impact.heading}
        stats={impact.stats}
        note={impact.note}
        source={impact.source}
        cta={impact.cta}
        branded
      />
      <ProjectTimeline
        heading={featuredWork.heading}
        items={featuredWork.highlights}
        empty={featuredWork.fallback}
      />
      <StoriesOfChange {...stories} />
      <TrustPanel {...transparency} />
      <GetInvolved heading={getInvolved.heading} tabs={getInvolved.tabs} />
      <RegularGiving
        heading={finalCta.heading}
        body={finalCta.body}
        cta={finalCta.ctas.primary}
        secondary={finalCta.ctas.secondary}
        src={finalCta.cardImage.src}
        alt={finalCta.cardImage.alt}
        focal={finalCta.cardImage.focal}
      />
    </>
  );
}
