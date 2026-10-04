import { cx } from "../../lib/cx.js";

/* THE card. Every card on the site is this one, with something in it:
   a flat surface, the 2px border, a hard offset shadow in the colour of
   the band it sits on, and — optionally — a degree or two of tilt.

     tone   card (white paper, the default) | ink | accent — the card's
            own surface. Its border and shadow still come from the BAND
            (`--tone-rim`, `--tone-cast`), so a white card casts Sky Blue
            on paper and on Deep Trust Blue, and Night on a Sky Blue band.
     cast   sm | md | lg | none — how far the shadow sits out. md for a
            card, lg for the one feature object of a section, sm for a
            chip-sized thing, none for a field-like tile.
     tilt   l | r | l-lg | r-lg — which way it leans. Leave it off for
            anything that holds a form or long text: tilt is for objects
            you look at, not ones you read or fill in.
     lift   straighten and rise on hover / focus-within. For cards that
            are links or contain one.
     pad    none | sm | md | lg

   ⚠ Never put a motion attribute (`.reveal`, `data-anim…`) on a tilted
   card, and never make one the direct child of a `data-anim-stagger`:
   the reveal would swallow the tilt (see `flyer` in styles/index.css).
   Reveal the <li> or <div> AROUND the card.

   `tiltAt(i)` hands a list its tilts in a fixed, alternating order so a
   grid leans this way and that without anyone choosing per card. */
const TONES = { card: "card", ink: "ink", accent: "accent", white: "card" };

const CAST = { none: "", sm: "cast-sm", md: "cast", lg: "cast-lg" };

const TILT = {
  l: "tilt-l",
  r: "tilt-r",
  "l-lg": "tilt-l-lg",
  "r-lg": "tilt-r-lg",
};

const PAD = {
  none: "",
  sm: "p-5 md:p-6",
  md: "p-6 md:p-8",
  lg: "p-7 md:p-10",
};

const ORDER = ["l", "r", "r", "l"];
export const tiltAt = (i) => ORDER[i % ORDER.length];

export default function OffsetCard({
  as: Tag = "div",
  tone = "card",
  cast = "md",
  tilt,
  lift = false,
  pad = "md",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag
      data-tone={TONES[tone] ?? "card"}
      className={cx(
        "relative rounded-2xl border-rim",
        CAST[cast] ?? CAST.md,
        PAD[pad] ?? PAD.md,
        (tilt || lift) && "flyer",
        TILT[tilt],
        lift && "flyer-lift",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
