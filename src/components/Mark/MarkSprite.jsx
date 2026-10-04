import { MARK_PATHS, MARK_SYMBOL_ID, MARK_VIEWBOX } from "./markPaths.js";

/* The mark's geometry, once per document.

   The supplied artwork is an auto-trace and carries 849 curve segments
   (see markPaths.js). Fifteen components draw the mark — watermarks,
   empty states, the hero's photo frame — and inlining that data at each
   of them put a quarter of a megabyte of path into the home page's HTML.
   Here it appears once, and every <Mark> is a one-line <use> pointing at
   it.

   `currentColor` survives the indirection, which is the whole reason the
   mark can be Sky Blue at 10% on a white card and white at 10% on a Deep
   Trust Blue band without a second file: `color` inherits into the
   shadow tree a <use> creates, so the paths resolve it against whatever
   the referencing element computes.

   ⚠ Rendered once, in App.jsx, above the router. A <use> whose target is
   not in the document draws NOTHING — silently, with no console error —
   so a Mark on a page this does not wrap is an invisible mark.

   Hidden by being 0×0 and out of flow, NOT by `hidden` or `display:
   none`. A <symbol> is never drawn where it sits either way, but
   `display: none` on the container has a long history of breaking <use>
   in one engine or another; every icon system that ships a sprite uses
   this shape instead, and it has nothing to go wrong. `aria-hidden`
   keeps a definition out of the accessibility tree. */
export default function MarkSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute h-0 w-0 overflow-hidden"
    >
      <symbol id={MARK_SYMBOL_ID} viewBox={MARK_VIEWBOX}>
        {MARK_PATHS.map((path, i) => (
          <path key={i} d={path.d} transform={`translate(${path.translate})`} />
        ))}
      </symbol>
    </svg>
  );
}
