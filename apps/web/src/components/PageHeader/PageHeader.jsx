import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";
import { withHighlight } from "../HighlightText/HighlightText.jsx";

/* The opening band of an inner page, set as a poster: a breadcrumb in
   small capitals, the kicker, the page's one <h1> in display type with
   its last word on the accent, and whatever intro it is given — beside
   an optional visual, and in front of the mark, enormous and faint.

   Pulled up under the fixed header (every offset reads `--header-h`), so
   the band starts at the top of the window, behind the header's pill.

     parent   the section the page sits in ({ label, to }). The trail is
              Home / parent / this page.
     kicker   the line over the <h1>
     crumb    the breadcrumb's name for this page, when the <h1> reads
              differently
     aside    a visual beside the copy from `lg`, below it on smaller
              screens
     tone     the band: paper (default) or ink
     highlight the words of the title on the accent block — a phrase, or
              a number of last words. None by default: the page decides,
              and most inner pages are stronger without it.

   ⚠ Motion is CSS, at first paint: this is the first screen of every
   inner page, and nothing here may wait for the bundle to hydrate. The
   heading and intro use `data-enter-text`, which never starts at opacity
   0 — the intro is the page's Largest Contentful Paint on a phone, and
   text animated up from nothing is not counted as painted until
   hydration (styles/index.css). */
export default function PageHeader({
  title,
  parent,
  kicker,
  crumb,
  aside,
  tone = "paper",
  highlight,
  children,
}) {
  const copy = (
    <div>
      {kicker && (
        <SectionKicker data-enter-item className="mt-10">
          {kicker}
        </SectionKicker>
      )}

      <h1
        data-enter-text
        style={{ "--enter-i": 1 }}
        className={cx("type-billboard hyphens-auto", kicker ? "mt-5" : "mt-10")}
      >
        {withHighlight(title, highlight)}
      </h1>

      <div data-enter-text style={{ "--enter-i": 1 }}>
        {children}
      </div>
    </div>
  );

  return (
    <section
      data-tone={tone}
      className="relative -mt-[var(--header-h)] overflow-clip pt-[var(--header-h)]"
    >
      <Mark className="pointer-events-none absolute -right-[14%] top-[2%] h-[min(90vw,44rem)] w-[min(90vw,44rem)] rotate-[8deg] text-fg opacity-[0.05]" />
      <Container className="relative pb-16 pt-10 md:pb-24 md:pt-14">
        <nav aria-label="Breadcrumb">
          <ol className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-quiet">
            <Crumb to="/">Home</Crumb>
            {parent && <Crumb to={parent.to}>{parent.label}</Crumb>}
            <li aria-current="page" className="text-fg">
              {crumb ?? title}
            </li>
          </ol>
        </nav>

        {aside ? (
          <div className="grid items-center gap-14 lg:grid-cols-[7fr_5fr] lg:gap-16">
            {copy}
            <div
              data-enter-item
              style={{ "--enter-i": 2 }}
              className="relative mt-4 lg:mt-10"
            >
              {aside}
            </div>
          </div>
        ) : (
          copy
        )}
      </Container>
    </section>
  );
}

function Crumb({ to, children }) {
  return (
    <li className="flex items-center gap-2">
      <Link
        to={to}
        className="rounded underline-offset-4 transition-colors hover:text-fg hover:underline"
      >
        {children}
      </Link>
      <span aria-hidden="true">/</span>
    </li>
  );
}
