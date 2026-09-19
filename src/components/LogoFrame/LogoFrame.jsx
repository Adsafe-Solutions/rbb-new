import { useId } from "react";
import { cx } from "../../lib/cx.js";
import {
  MARK_CENTER,
  MARK_OUTER_R,
  MARK_PATHS,
  MARK_VIEWBOX,
} from "../Mark/markPaths.js";

/* A photograph held inside the RBB mark.

   The mark is eight figures standing in a ring with their arms reaching
   into the middle. Its own centre is empty, but only out to a radius of
   60 in a mark 490 across — there is no room in there for a picture. So
   the photograph is laid OVER the mark as a disc wide enough to cover the
   arms, and the mark is masked to the ring outside it. What is left is the
   part of the logo that carries it: the eight heads and the shoulders
   linking them, standing around the image.

   The arms run UNDER the photograph's edge rather than stopping at it,
   which is the whole reason this reads as one piece of artwork with a
   picture resting in it rather than a border drawn around a circle.

   These are the logo's own paths, not an interpretation of them. An
   earlier version approximated each figure with a circle and a crescent;
   at hero size the difference is the entire point.

   ⚠ The box must stay SQUARE. PHOTO_R is applied to the photograph as a
   CSS `circle()` and to the mask as an SVG circle. On a non-square box the
   first resolves against the box's diagonal and the second against the
   viewBox, so ring and image drift apart by a few pixels and the seam
   opens up. `aspect-square` on the root is load-bearing. */

/* Where the photograph's edge falls, in the mark's own units (its outer
   radius is MARK_OUTER_R = 245).

   165 puts it just under the dense band of heads, which starts at 168 —
   close enough that the heads appear to lean over the picture, far enough
   that none of them is cut. Below about 150 the sparse inner arms start
   showing through as blue crumbs on the image; above about 180 the mask
   eats into the heads. */
const PHOTO_R = 165;

/* The photograph as a share of the whole frame. The svg is cropped to the
   mark, so the mark spans the box and this converts straight across. */
const PHOTO_PCT = (PHOTO_R / MARK_OUTER_R) * 50;

export default function LogoFrame({ spin = true, className = "", children }) {
  /* useId, not a module counter: two frames on one page would otherwise
     share a mask id and the second would silently inherit the first. */
  const maskId = `logo-frame-${useId().replace(/:/g, "")}`;

  return (
    <div className={cx("relative aspect-square w-full", className)}>
      {/* The photograph. A CSS clip rather than an SVG <image> so the
          children stay ordinary HTML — <img> with object-cover, a badge,
          a caption — and so Hero's cross-fade is a plain opacity
          transition on real elements. */}
      <div
        className="absolute inset-0 bg-mist"
        style={{ clipPath: `circle(${PHOTO_PCT}% at 50% 50%)` }}
      >
        {children}
      </div>

      <svg
        viewBox={MARK_VIEWBOX}
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0 h-full w-full",
          /* Ninety seconds for one turn. Slow enough to read as the ring
             breathing rather than as a spinner, and it never competes with
             the photograph. `motion-reduce` is not optional here: a
             rotating ring is precisely what vestibular motion sensitivity
             reacts to. */
          spin && "animate-[spin_90s_linear_infinite] motion-reduce:animate-none"
        )}
      >
        <defs>
          {/* White keeps, black drops. The ring is everything outside the
              photograph's edge. */}
          <mask id={maskId}>
            <circle
              cx={MARK_CENTER}
              cy={MARK_CENTER}
              r={MARK_OUTER_R}
              fill="#fff"
            />
            <circle cx={MARK_CENTER} cy={MARK_CENTER} r={PHOTO_R} fill="#000" />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`} fill="currentColor">
          {MARK_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
