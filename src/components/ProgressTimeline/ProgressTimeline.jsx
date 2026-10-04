import { useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import { formatDate } from "../../lib/dates.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import YouTubePlayer from "../YouTubePlayer/YouTubePlayer.jsx";

/* The events so far, oldest first, as a row of cards over a timeline.
   Each card is a YouTube Short (played in place, components/
   YouTubePlayer), its date, program and one line.

   Two ways to move along it, and the same picture either way:
     · with motion, phone or desktop — the section pins and the page's
       own scroll slides the row sideways (animations/timeline.js, bound
       from the `data-timeline*` attributes below; this component writes
       no motion of its own)
     · reduced motion, or before the motion system binds — the row is a
       native sideways strip with snap points
   The ACTIVE event is the one at the timeline's current point: from the
   motion system's `timeline:active` event while pinned, from the strip's
   own scroll otherwise. It gets the Sky Blue ring and lift; the rail
   fills up to it and its dot is ringed.

   `timeline` is content/homepage.js `timeline`; `programOf(slug)` names
   a program. Each event's `releaseMarker` is never shown — it is the
   release markers' hook (`hidden`, off screen and out of the
   accessibility tree). */
export default function ProgressTimeline({ index, timeline, programOf, tone = "white", highlight }) {
  const headingId = useId();
  const section = useRef(null);
  const viewport = useRef(null);
  const [active, setActive] = useState(0);
  const events = timeline.events;
  const last = events.length - 1;

  /* Pinned mode: the motion system says which event is current. */
  useEffect(() => {
    const el = section.current;
    const onActive = (e) => setActive(e.detail);
    el?.addEventListener("timeline:active", onActive);
    return () => el?.removeEventListener("timeline:active", onActive);
  }, []);

  /* Strip mode: the card whose centre is nearest the strip's centre. A
     pinned row does not scroll natively, so this is idle there. */
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (section.current?.dataset.timelinePinned !== undefined) return;
      const mid = vp.getBoundingClientRect().left + vp.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      vp.querySelectorAll("[data-timeline-item]").forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      /* At either end of the strip the end card is current, even when a
         wide screen cannot bring it to the centre. */
      if (vp.scrollLeft <= 2) best = 0;
      else if (vp.scrollLeft + vp.clientWidth >= vp.scrollWidth - 2) best = last;
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [last]);

  return (
    <section
      ref={section}
      data-tone={tone}
      data-timeline=""
      aria-labelledby={headingId}
      className="group/timeline relative scroll-mt-[var(--header-h)] [--short-h:clamp(14rem,40svh,24rem)] [--card-w:min(78vw,20rem)] md:[--card-w:calc(var(--short-h)*3/4+1.25rem)]"
    >
      <div data-timeline-pin="" className="flex flex-col justify-center overflow-clip py-16 md:py-24 group-data-[timeline-pinned]/timeline:min-h-svh group-data-[timeline-pinned]/timeline:py-0 group-data-[timeline-pinned]/timeline:pt-[var(--header-h)]">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id={headingId} index={index} kicker={timeline.kicker} heading={timeline.heading} highlight={highlight} />
            {timeline.cta && (
              <Button to={timeline.cta.to} variant="outline" className="self-start md:self-auto">
                {timeline.cta.label}
              </Button>
            )}
          </div>
        </Container>

        {/* The window onto the row: a native, keyboard-scrollable strip
            until the motion system pins it (then overflow is hidden and
            the row moves by transform). The row is padded by half the
            window less half a card at each end, so the first and last
            events can reach the centre — the timeline's "now" — and the
            current event is always the one in the middle. */}
        <div
          ref={viewport}
          data-timeline-viewport=""
          role="region"
          aria-label={timeline.viewportLabel}
          tabIndex={0}
          className="mt-8 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[var(--tone-ring)] md:mt-10 group-data-[timeline-pinned]/timeline:mt-6 group-data-[timeline-pinned]/timeline:snap-none group-data-[timeline-pinned]/timeline:overflow-hidden [&::-webkit-scrollbar]:hidden"
        >
          <ol
            data-timeline-track=""
            className="flex w-max gap-cards px-[calc(50vw-var(--card-w)/2)] pb-2 pt-3"
          >
            {events.map((event, i) => {
              const state = i < active ? "past" : i === active ? "active" : "future";
              return (
                <li
                  key={event.id}
                  data-timeline-item=""
                  data-state={state}
                  className="flex w-[var(--card-w)] shrink-0 snap-center flex-col"
                >
                  {event.releaseMarker && <span hidden data-release-marker={event.releaseMarker} />}
                  <article
                    data-tone="card"
                    className={cx(
                      /* flex-1: every card in the row is as tall as the
                         tallest, so the rail below runs level. */
                      "flex-1 rounded-2xl border-2 bg-ground p-2.5 transition-[transform,box-shadow,border-color] duration-300 motion-reduce:transition-none",
                      state === "active" ? "-translate-y-1 border-pop cast-lg" : "border-[var(--tone-rim)] cast"
                    )}
                  >
                    <YouTubePlayer
                      youtubeId={event.youtubeId}
                      title={event.videoTitle}
                      playLabel={timeline.playLabel}
                      poster={event.poster}
                      /* 3:4, not the Short's own 9:16: the card is wider
                         without being taller, so the pinned block still fits
                         the window. On a phone the frame is near square and
                         capped at a third of the screen's height, so the
                         pinned card, rail and date fit a 640px-tall phone
                         under the header. The poster fills the frame; a
                         playing Short sits centred on its dark ground. */
                      ratio="h-[min(calc(var(--card-w)-1.25rem),34svh)] md:h-auto md:aspect-[3/4]"
                      size="md"
                      sizes="(min-width: 768px) 18rem, 78vw"
                    />
                    <div className="px-1.5 pb-2 pt-4">
                      {programOf(event.program) && <p className="type-meta text-quiet">{programOf(event.program)}</p>}
                      <h3 className="type-card mt-2 text-[17px] leading-snug md:text-[19px]">{event.title}</h3>
                      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-copy">{event.summary}</p>
                    </div>
                  </article>

                  {/* The timeline under the card: the rail runs card to
                      card through the gap, filled up to the active event;
                      the dot and the date sit on it. Decorative — the
                      date is also in the text, as <time>. */}
                  <div className="relative mt-5 h-6" aria-hidden="true">
                    {i > 0 && (
                      <span className={cx("absolute left-0 top-1/2 h-1 w-1/2 -translate-y-1/2 transition-colors duration-300", i <= active ? "bg-pop" : "bg-hair")} />
                    )}
                    {i < last && (
                      <span className={cx("absolute left-1/2 top-1/2 h-1 w-[calc(50%+var(--gap-cards))] -translate-y-1/2 transition-colors duration-300", i < active ? "bg-pop" : "bg-hair")} />
                    )}
                    <span
                      className={cx(
                        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300",
                        state === "active" ? "h-6 w-6 border-pop bg-ground shadow-[0_0_0_4px_var(--tone-hair)]" : state === "past" ? "h-4 w-4 border-pop bg-pop" : "h-4 w-4 border-[var(--tone-hair)] bg-ground"
                      )}
                    >
                      {state === "active" && <span className="absolute inset-1 rounded-full bg-pop" />}
                    </span>
                  </div>
                  <p className="mt-2 text-center">
                    <time
                      dateTime={event.date}
                      className={cx(
                        "inline-block rounded-full border-2 px-3 py-1 text-[15px] font-semibold transition-colors duration-300",
                        state === "future" ? "border-[var(--tone-hair)] text-quiet" : "border-pop text-fg"
                      )}
                    >
                      {formatDate(event.date)}
                    </time>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
