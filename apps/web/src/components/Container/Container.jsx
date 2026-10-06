import { cx } from "../../lib/cx.js";

/* The contained column — 1320px, centred, with the side gutter that keeps
   content off the edge on a phone.

   Full-bleed bands do not use this: they run edge to edge and put a
   Container inside themselves for their own copy. That alternation between
   bleed and column is the page's rhythm. */
export default function Container({ as: Tag = "div", className = "", children }) {
  return (
    <Tag
      className={cx(
        "mx-auto w-full max-w-[var(--page-max-width)] px-5 md:px-8",
        className
      )}
    >
      {children}
    </Tag>
  );
}
