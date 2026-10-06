import PosterHero from "../../components/PosterHero/PosterHero.jsx";
import EditorialSplit from "../../components/EditorialSplit/EditorialSplit.jsx";
import ProgramAreas from "../../components/ProgramAreas/ProgramAreas.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProgressTimeline from "../../components/ProgressTimeline/ProgressTimeline.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import CtaSection from "../../components/CtaSection/CtaSection.jsx";
import VideoFeature from "../../components/VideoFeature/VideoFeature.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import { HOMEPAGE, programBySlug } from "../../content/index.js";

/* The homepage — Document 02, in its section order. Each section answers
   one question, and the page reads top to bottom as: who we are → what we
   do → how we work → what it achieves → the evidence → why trust us → how
   to take part.

   The bands are colour-blocked, and no two neighbours share a ground —
   the change of colour is what separates them:

     —   paper   PosterHero       a slideshow: headline as a poster, two prints
     01  white   EditorialSplit   who we are
     02  ink     ProgramAreas     four flyers, the program names marquee
     03  accent  ApproachFlow     the approach, as a statement
     04  paper   ImpactStats      the figures, made the loudest thing here
     05  white   ProgressTimeline the events so far: Shorts on a scroll-driven timeline
     06  paper   StoriesOfChange  lead story + supporting rows
     07  ink     TrustPanel       the documents, as a ticket
     08  white   GetInvolved      the four ways in, as action boxes
     09  paper   Faq              the practical questions, before the ask
     —   accent  CtaSection       the closing ask; the Deep Trust Blue footer
                                  follows

   Two Deep Trust Blue bands and the footer — the blue is for the wall of
   programs and the trust statement, where it means something, and the
   paper carries the rest.

   Every string comes from content/homepage.js. Each section carries its
   own motion attributes; the page itself says nothing about how any of
   it moves.

   The timeline, the stories and the film appear only with RBB's own
   content in them — never sample items — and the section numbers count
   only what is on the page. Without them, paper ImpactStats meets the ink
   TrustPanel directly, so the colour-blocking still holds. */
const programOf = (slug) => programBySlug(slug)?.title;

export default function Home() {
  const { hero, whoWeAre, programs, approach, impact, timeline, stories, video, transparency, getInvolved, faq, finalCta } =
    HOMEPAGE;

  const hasTimeline = timeline.events.length > 0;
  const hasStories = stories.items.length > 0;
  const hasVideo = Boolean(video.youtubeId);
  let n = 4;
  const next = () => ++n;

  return (
    <>
      <PosterHero {...hero} />
      <EditorialSplit
        index={1}
        kicker={whoWeAre.kicker}
        heading={whoWeAre.heading}
        highlight="with people"
        body={whoWeAre.body}
        cta={whoWeAre.cta}
        secondary={whoWeAre.collage.secondary}
        image={whoWeAre.collage.photos.wide}
      />
      <ProgramAreas index={2} {...programs} />
      <ApproachFlow index={3} {...approach} />
      <ImpactStats
        index={4}
        tone="paper"
        kicker={impact.kicker}
        heading={impact.heading}
        body={impact.body}
        stats={impact.stats}
        note={impact.note}
        source={impact.source}
        cta={impact.cta}
      />
      {/* The events so far, travelling along a timeline as the page
          scrolls (content/homepage.js `timeline`). */}
      {hasTimeline && <ProgressTimeline index={next()} timeline={timeline} programOf={programOf} />}
      {hasStories && <StoriesOfChange index={next()} {...stories} />}
      {/* White between the paper stories and the ink transparency band. */}
      {hasVideo && <VideoFeature index={next()} video={video} highlight="up close" />}
      <TrustPanel index={next()} {...transparency} />
      <GetInvolved index={next()} kicker={getInvolved.kicker} heading={getInvolved.heading} items={getInvolved.items} />
      {faq.items.length > 0 && (
        <Faq id={faq.id} index={next()} tone="paper" kicker={faq.kicker} heading={faq.heading} items={faq.items} highlight="questions" />
      )}
      <CtaSection tone="accent" highlight="beyond borders" heading={finalCta.heading} body={finalCta.body} ctas={finalCta.ctas} />
    </>
  );
}
