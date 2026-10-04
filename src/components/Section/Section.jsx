import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";

/* A full-width band of one colour — the unit the pages are built from.

   The site's rhythm is the sequence of these: paper, then Deep Trust
   Blue, then Sky Blue, then paper again. A page is a stack of Sections
   and the only decision each one makes about colour is its `tone`
   (styles/index.css): everything inside — headings, body text, cards'
   shadows, buttons, focus rings — follows from that one attribute.

     tone       paper | white | ink | accent | night
     pad        vertical rhythm: none | sm | md | lg
     watermark  the mark, oversized and faint, bled off one side:
                "left" | "right" | "center". Decoration only.
     bare       skip the Container, for a band that lays out its own
                full-bleed content (a marquee, an edge-to-edge image)

   ⚠ `overflow-clip`, NOT `overflow-hidden`. The watermark and tilted
   cards overhang the band and have to be cut off at its edge — but
   `hidden` would make the band a scroll container, and a `sticky` rail
   inside it would stop sticking. `clip` cuts the same overflow without
   creating one. (The same reasoning as `overflow-x-clip` on body.)

   No two neighbouring bands should share a tone: the change of ground
   is what separates them, so there are no dividers between sections. */
const PAD = {
  none: "",
  sm: "py-12 md:py-16",
  md: "py-16 md:py-24",
  lg: "py-20 md:py-32",
};

/* Each position bleeds the mark past the band's edge, so it is cropped
   by the band rather than sitting in it like a logo. */
const WATERMARK = {
  right: "-right-[12%] top-[8%] rotate-[8deg]",
  left: "-left-[14%] bottom-[-18%] -rotate-[8deg]",
  center: "left-1/2 top-[6%] -translate-x-[42%] -rotate-[8deg]",
};

export default function Section({
  as: Tag = "section",
  tone = "paper",
  pad = "md",
  watermark,
  bare = false,
  className = "",
  containerClassName = "",
  children,
  ...rest
}) {
  return (
    <Tag
      data-tone={tone}
      className={cx("relative scroll-mt-[var(--header-h)] overflow-clip", PAD[pad] ?? PAD.md, className)}
      {...rest}
    >
      {watermark && (
        <Mark
          className={cx(
            "pointer-events-none absolute h-[min(78vw,44rem)] w-[min(78vw,44rem)] text-fg opacity-[0.05]",
            WATERMARK[watermark] ?? WATERMARK.right
          )}
        />
      )}
      {bare ? children : <Container className={cx("relative", containerClassName)}>{children}</Container>}
    </Tag>
  );
}
