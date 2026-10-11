/* Where a floating layer (tooltip, menu) goes, in viewport coordinates.
   It is positioned `fixed`, so a scrolling or clipping ancestor — the
   sidebar's nav, a table's overflow wrapper — cannot cut it off. */

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

const GAP = 6;
const EDGE = 8;

export function placeFloating(anchor: DOMRect, floating: { width: number; height: number }, side: Side, align: Align = "center") {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Flip to the other side when there is no room.
  let chosen = side;
  if (side === "top" && anchor.top - floating.height - GAP < EDGE) chosen = "bottom";
  else if (side === "bottom" && anchor.bottom + floating.height + GAP > vh - EDGE && anchor.top - floating.height - GAP >= EDGE) chosen = "top";
  else if (side === "right" && anchor.right + floating.width + GAP > vw - EDGE) chosen = "left";
  else if (side === "left" && anchor.left - floating.width - GAP < EDGE) chosen = "right";

  let top: number;
  let left: number;
  if (chosen === "top" || chosen === "bottom") {
    top = chosen === "top" ? anchor.top - floating.height - GAP : anchor.bottom + GAP;
    left = align === "start" ? anchor.left : align === "end" ? anchor.right - floating.width : anchor.left + anchor.width / 2 - floating.width / 2;
  } else {
    left = chosen === "left" ? anchor.left - floating.width - GAP : anchor.right + GAP;
    top = anchor.top + anchor.height / 2 - floating.height / 2;
  }
  left = Math.min(Math.max(left, EDGE), vw - floating.width - EDGE);
  top = Math.min(Math.max(top, EDGE), vh - floating.height - EDGE);
  return { top, left, side: chosen };
}
