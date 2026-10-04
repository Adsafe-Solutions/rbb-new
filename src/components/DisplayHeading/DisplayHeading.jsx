import { cx } from "../../lib/cx.js";
import { withHighlight } from "../HighlightText/HighlightText.jsx";

/* A headline in the poster scale.

   `as` is the element (the outline is the page's business, not the
   size's), `size` is the role — the `type-*` utilities in
   styles/index.css carry the weight, case, leading and tracking:

     poster     the homepage hero
     billboard  a closing call to action
     title      an inner page's <h1>, a section's <h2>
     card       a card's heading

   `highlight` puts part of the heading on the accent block: a phrase
   ("people"), a number of last words, or `true` for the last word. Off
   by default — the device is a signature because it is not on every
   heading (HighlightText).

   The copy stays sentence case in src/content; the capitals are CSS. */
const SIZES = {
  poster: "type-poster",
  billboard: "type-billboard",
  title: "type-title",
  card: "type-card",
};

export default function DisplayHeading({
  as: Tag = "h2",
  size = "title",
  highlight = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag className={cx(SIZES[size] ?? SIZES.title, className)} {...rest}>
      {withHighlight(children, highlight === true ? 1 : highlight)}
    </Tag>
  );
}
