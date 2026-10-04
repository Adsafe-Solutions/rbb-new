import { cx } from "../../lib/cx.js";

/* Any element that carries a tone — the smallest piece of the colour
   system. `data-tone` is the whole of it: the rules in styles/index.css
   give the element its ground and its text colour, and re-point the
   `text-fg` / `bg-pop` / `border-edge` utilities for everything inside.

   Section is this as a full-width band and OffsetCard is this as an
   object; reach for Surface itself only for something that is neither —
   a panel inside a band that needs to turn the colours around. */
export default function Surface({ as: Tag = "div", tone = "paper", className = "", children, ...rest }) {
  return (
    <Tag data-tone={tone} className={cx(className)} {...rest}>
      {children}
    </Tag>
  );
}
