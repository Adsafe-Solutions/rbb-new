import { cx } from "../../lib/cx.js";

/* The circular Member Circle seal that sits over the dinner photograph.

   Drawn as SVG rather than exported as an image for one reason: the text
   runs around the circle, and a bitmap of curved type goes soft the moment
   it is scaled. A `<textPath>` stays crisp at any size and the label comes
   from content, so a rename is a prop rather than a new export.

   ⚠ The label is repeated twice around the ring, each occupying half the
   circumference. Change the label length and the two copies still meet —
   `textLength` is not set on purpose, so a long label tracks wider rather
   than overlapping its other half. */
export default function Seal({ label = "Member Circle", className = "" }) {
  const id = `seal-path-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
      className={cx("h-32 w-32", className)}
    >
      <defs>
        {/* The baseline the ring text rides on. Radius 74 leaves the type
            sitting inside the outer stroke rather than straddling it. */}
        <path
          id={id}
          fill="none"
          d="M 100,100 m -74,0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
        />
      </defs>

      {/* Outer ring and inner disc. The disc is ink so the mark at the
          centre reads in honey — the one place in the system where yellow
          sits on dark rather than the other way round. */}
      <circle cx="100" cy="100" r="96" fill="var(--color-bumble-honey)" />
      <circle cx="100" cy="100" r="82" fill="var(--color-bumble-ink)" />
      <circle cx="100" cy="100" r="58" fill="var(--color-bumble-honey)" />

      <text
        fill="var(--color-bumble-ink)"
        fontFamily="var(--font-bumblesans)"
        fontSize="15"
        fontWeight="700"
        letterSpacing="2.4"
      >
        <textPath href={`#${id}`} startOffset="2%">
          {label.toUpperCase()}
        </textPath>
        <textPath href={`#${id}`} startOffset="52%">
          {label.toUpperCase()}
        </textPath>
      </text>

      {/* The hexagon at the centre — the membership mark. */}
      <g transform="translate(100 100)">
        <path
          d="M 0,-34 L 29,-17 L 29,17 L 0,34 L -29,17 L -29,-17 Z"
          fill="var(--color-bumble-ink)"
        />
        <rect
          x="-13"
          y="-9"
          width="26"
          height="6"
          rx="3"
          fill="var(--color-bumble-honey)"
        />
        <rect
          x="-13"
          y="3"
          width="26"
          height="6"
          rx="3"
          fill="var(--color-bumble-honey)"
        />
      </g>
    </svg>
  );
}
