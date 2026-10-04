import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";

/* A strip of display type that runs slowly along the edge of a band,
   the mark between each phrase — the selvedge of a printed sheet.

   `items` are short strings that already exist elsewhere on the page
   (the program names, the organisation's name): the strip repeats, it
   never introduces. So it is `aria-hidden` — a screen reader would
   otherwise read the list twice over, once for each copy the loop needs.

   The track holds the items twice and travels half its own width, so
   the loop has no seam; the keyframes and the reduced-motion stop are in
   styles/index.css. Used once on a page, at most.

   Sky Blue type on Deep Trust Blue is 3.89:1 — display sizes only,
   which this is, and decorative besides. */
export default function Marquee({ items, seconds = 40, className = "" }) {
  if (!items?.length) return null;
  /* Enough repeats that one half of the track is wider than any
     screen, whatever the phrases' length. */
  const set = Array.from({ length: Math.max(2, Math.ceil(12 / items.length)) }, () => items).flat();

  return (
    <div aria-hidden="true" className={cx("overflow-hidden py-5", className)}>
      <div className="marquee-track" style={{ "--marquee-seconds": `${seconds}s` }}>
        {[0, 1].map((half) => (
          <ul key={half} className="flex shrink-0 items-center">
            {set.map((item, i) => (
              <li key={i} className="type-card flex items-center whitespace-nowrap uppercase text-pop">
                <span className="px-5 md:px-7">{item}</span>
                <Mark className="h-6 w-6 text-fg" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
