import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { ChevronIcon, MenuIcon } from "../Header/icons.jsx";

/* The announcement bar — a slim Deep Trust Blue strip over the header
   pill, cycling through short messages (content/announcements.js `bar`),
   each with an optional link.

   Rendered inside the fixed header (components/Header), full-bleed, at
   `--announce-h` tall; while it shows, App.jsx puts `.has-announcement`
   round the page so everything that reads `--header-h` makes room for it
   (styles/index.css). Closing it is `onClose` — the bar and the extra
   room go together, for the rest of this visit.

   Moves on every `interval` ms after hydration, and stops while the
   pointer is over it or focus is in it; with reduced motion it never
   moves on its own. Previous / next step through it, and close hides it
   — the "pause, stop or hide" moving content must offer (WCAG 2.2.2).
   Every message is in the DOM for assistive tech as a list; only the
   current one is shown. */
export default function AnnouncementBar({ bar, onClose }) {
  const { items, interval = 5000 } = bar;
  const total = items.length;
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [held, setHeld] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(media.matches);
    onMotion();
    media.addEventListener("change", onMotion);
    return () => media.removeEventListener("change", onMotion);
  }, []);

  const go = (index) => {
    setActive((index + total) % total);
    setCycle((c) => c + 1);
  };

  useEffect(() => {
    if (!hydrated || reduced || held || total < 2) return undefined;
    const timer = setTimeout(() => go(active + 1), interval);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cycle, held, hydrated, reduced, interval, total]);

  const item = items[active];
  const arrow =
    "hidden h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:bg-pop hover:text-on-pop sm:grid";

  return (
    <div
      data-tone="ink"
      role="region"
      aria-label={bar.label}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      className="relative flex h-[var(--announce-h)] items-center gap-2 bg-ground px-3 sm:px-4"
    >
      {total > 1 && (
        <button type="button" aria-label={bar.previous} onClick={() => go(active - 1)} className={arrow}>
          <ChevronIcon className="h-4 w-4 rotate-90" />
        </button>
      )}

      {/* The current message, re-mounted on every change so it arrives
          from below (`data-announce-item`, styles/index.css). One line:
          the bar's height is the page's header offset. */}
      {/* Only the message truncates on a narrow screen; its link never
          does — it is the point of the message. */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          key={`${item.id}-${cycle}`}
          data-announce-item
          className="flex items-center justify-center gap-2 text-[13px] font-semibold text-fg sm:text-[14px]"
        >
          {item.releaseMarker && <span hidden data-release-marker={item.releaseMarker} />}
          <span className="min-w-0 truncate">{item.text}</span>
          {item.link && (
            <Link
              to={item.link.to}
              className="shrink-0 font-extrabold underline decoration-bumble-honey decoration-2 underline-offset-4 hover:decoration-[3px]"
            >
              {item.link.label}
            </Link>
          )}
        </p>
      </div>

      {total > 1 && (
        <button type="button" aria-label={bar.next} onClick={() => go(active + 1)} className={arrow}>
          <ChevronIcon className="h-4 w-4 -rotate-90" />
        </button>
      )}

      <button
        type="button"
        aria-label={bar.close}
        onClick={onClose}
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:bg-pop hover:text-on-pop [&_svg]:h-4 [&_svg]:w-4"
      >
        <MenuIcon open />
      </button>
    </div>
  );
}
