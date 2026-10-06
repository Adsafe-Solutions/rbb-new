import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import Picture from "../Picture/Picture.jsx";

/* A YouTube film that loads nothing from YouTube until it is played.

   The page ships a LOCAL poster and a play button. The privacy-enhanced
   player (youtube-nocookie.com) is created only when the visitor
   presses play, so a visit that never plays it makes no third-party
   request and sets no cookie; the origin is allowed as a frame on the
   homepage only (scripts/security-policy.mjs VIDEO). Once playing,
   focus moves into the player so a keyboard user can control it.

     youtubeId  the video (a regular film or a Short)
     title      the player's accessible name, and the button's
     playLabel  the button's verb ("Play video")
     poster     { src, alt } — a local photograph; alt is not used, the
                button names the film instead
     ratio      the frame's aspect class ("aspect-video", "aspect-[9/16]")
     sizes      the poster's `sizes`
     size       "lg" | "md" — the play button */
export default function YouTubePlayer({ youtubeId, title, playLabel, poster, ratio = "aspect-video", sizes = "100vw", size = "lg", className = "" }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef(null);

  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&playsinline=1`;
  const button = size === "md" ? "h-14 w-14 [&>svg]:h-6 [&>svg]:w-6" : "h-18 w-18 sm:h-22 sm:w-22 [&>svg]:h-8 [&>svg]:w-8 sm:[&>svg]:h-10 sm:[&>svg]:w-10";

  return (
    <div className={cx("relative overflow-hidden rounded-xl bg-night", ratio, className)}>
      {playing ? (
        <iframe
          ref={frame}
          src={src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`${playLabel}: ${title}`}
          className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-night"
        >
          <Picture
            src={poster.src}
            alt=""
            sizes={sizes}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          {/* A scrim so the button reads on any still. */}
          <span aria-hidden="true" className="absolute inset-0 bg-night/25 transition-colors group-hover:bg-night/15" />
          <span
            aria-hidden="true"
            className={cx(
              "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bumble-honey text-night shadow-[4px_4px_0_var(--color-night)] transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none",
              button
            )}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
