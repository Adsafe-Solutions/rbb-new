/* =========================================================
   Count-up — a figure counting to the number that is already on the
   page.

   ⚠ THE VALUE IS READ OFF THE RENDERED ELEMENT. Nothing here knows
   what any figure is, and no number is ever written into an animation
   component: the content files are the one place a figure exists
   (content/impact.js), and this reads back whatever they rendered.
   "50K+" counts to 50 and keeps its "K+"; "1,250" counts to 1,250 and
   keeps its comma.

   ⚠ It is also OPT-IN PER FIGURE, and the opt-in is editorial, not
   visual. A figure RBB has not verified yet must not be presented
   with the small triumph of a count-up — that is a claim about the
   number, made in motion. components/ImpactStats passes `data-count`
   only for a figure whose status is verified or approved; today that
   is none of them, so nothing on the site counts, and each one starts
   the day RBB confirms it.

   Whatever happens, the finished text is exactly the text the content
   file supplied — including when the animation never runs, is
   reverted, or the reader asked for no motion.
========================================================= */
import { gsap } from "./gsap.js";
import { DURATION, EASE, ONCE, START } from "./config.js";

/* "50K+" → ["", "50", "K+"]. The number is whatever run of digits
   (with grouping separators, and an optional decimal part) the string
   starts its numeric section with; everything before and after it is
   kept verbatim. */
const FIGURE = /^(\D*?)(\d[\d,   ]*(?:\.\d+)?)(.*)$/s;

/* Below this a count-up is pointless — nobody reads "1, 2, 3" as
   counting, and the flicker costs more than the effect is worth. */
const MINIMUM = 10;

/* Counts `el` up to the figure it already contains, when the page
   scrolls to it. Returns a teardown that puts the original string
   back, or null when there is nothing countable here. */
export function bindCounter(el) {
  const original = el.textContent;
  const match = original.trim().match(FIGURE);
  if (!match) return null;

  const [, prefix, digits, suffix] = match;
  const separators = /[,   ]/g;
  const value = Number(digits.replace(separators, ""));
  if (!Number.isFinite(value) || value < MINIMUM) return null;

  /* Keep the figure's own typography: its grouping, and its number of
     decimal places. A figure written "1,250" must not land on "1250". */
  const grouped = separators.test(digits);
  const decimals = (digits.split(".")[1] ?? "").length;
  const write = (n) =>
    `${prefix}${n.toLocaleString("en-US", {
      useGrouping: grouped,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  /* ⚠ Lining figures while it counts. Proportional digits are
     different widths, so a number climbing through 1→9 twitches, and
     on a right-aligned or centred card it drags the whole line with
     it. Removed again at the end, so the final figure is set exactly
     as the rest of the site sets numbers. */
  const numeric = el.style.fontVariantNumeric;
  el.style.fontVariantNumeric = "tabular-nums";

  const counter = { n: 0 };
  el.textContent = write(0);

  gsap.to(counter, {
    n: value,
    duration: DURATION.count,
    ease: EASE.soft,
    /* Whole steps for a whole number; the figure's own precision
       otherwise. */
    snap: decimals ? { n: 10 ** -decimals } : { n: 1 },
    onUpdate: () => {
      el.textContent = write(counter.n);
    },
    onComplete: () => {
      el.textContent = original;
      el.style.fontVariantNumeric = numeric;
    },
    scrollTrigger: { trigger: el, start: START, once: ONCE },
  });

  return () => {
    el.textContent = original;
    el.style.fontVariantNumeric = numeric;
  };
}
