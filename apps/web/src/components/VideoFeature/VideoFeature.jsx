import { useId } from "react";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import YouTubePlayer from "../YouTubePlayer/YouTubePlayer.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A film, set as an object on the page: a white print, tilted, with the
   play button over a still — the same card the site's flyers are made
   of. The heading and a line beside it; stacked on a phone.

   Click to play, through components/YouTubePlayer: nothing loads from
   YouTube until the visitor presses play.

   `video` is content/homepage.js `video`: { kicker, heading, body,
   youtubeId, title, playLabel, poster: { src, alt }, releaseMarker }.
   `releaseMarker` is never shown — it is the release markers' hook
   (`hidden`, so off screen and out of the accessibility tree). */
export default function VideoFeature({ index, video, tone = "white", highlight }) {
  const headingId = useId();
  return (
    <Section tone={tone} pad="lg" aria-labelledby={headingId}>
      {video.releaseMarker && <span hidden data-release-marker={video.releaseMarker} />}
      <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div>
          <SectionHeading id={headingId} index={index} kicker={video.kicker} heading={video.heading} highlight={highlight} />
          {video.body && <p className="type-lead reveal mt-6 max-w-[40ch] text-copy">{video.body}</p>}
        </div>

        {/* Reveal the wrapper, tilt the card: the motion system folds a
            revealed element's own rotate away (CLAUDE.md). */}
        <div className="reveal">
          <OffsetCard pad="none" tilt="r" cast="lg" className="p-2.5 sm:p-3">
            <YouTubePlayer
              youtubeId={video.youtubeId}
              title={video.title}
              playLabel={video.playLabel}
              poster={video.poster}
              ratio="aspect-video"
              sizes="(min-width: 1024px) 55vw, 92vw"
            />
          </OffsetCard>
        </div>
      </div>
    </Section>
  );
}
