import { Link, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Picture from "../Picture/Picture.jsx";
import { cardFocal } from "../../lib/focal.js";

/* The story circles over the navbar — up to four appeals, each a round
   photograph in a ring with its short name under it, linking to its
   appeal page (content/appeals.js: `story` on an appeal, APPEAL_STORIES for the
   switch and the limit).

   The ring is the system's accent, flat — a gradient ring is the
   platform's look, not this one. The current appeal's ring turns Deep
   Trust Blue and its name is marked `aria-current`.

   Rendered at the top of the fixed header (components/Header), exactly
   `--stories-h` tall; it slides away with the header once the page is
   scrolled (styles/index.css `.has-stories`). On a phone four circles
   fit a 320px screen; anything wider scrolls sideways rather than wrap,
   since the strip's height is part of the page's header offset. */
export default function StoryStrip({ items, label }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={label}
      data-tone="paper"
      className="h-[var(--stories-h)] border-b-2 border-hair bg-ground"
    >
      <ul className="mx-auto flex h-full max-w-[var(--page-max-width)] items-center justify-start gap-4 overflow-x-auto px-4 [scrollbar-width:none] sm:justify-center sm:gap-10 md:gap-16 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const current = pathname === item.to;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                to={item.to}
                aria-current={current ? "page" : undefined}
                className="group flex w-[4.75rem] flex-col items-center gap-2 rounded-xl text-center sm:w-auto sm:min-w-28"
              >
                <span
                  className={cx(
                    "block rounded-full p-[3px] transition-transform duration-300 group-hover:scale-[1.06] motion-reduce:group-hover:scale-100",
                    current ? "bg-trust-blue" : "bg-pop"
                  )}
                >
                  <span className="block rounded-full bg-paper-white p-[3px]">
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full sm:h-20 sm:w-20">
                      {item.image?.src && (
                        <Picture
                          src={item.image.src}
                          alt=""
                          focal={cardFocal(item.image)}
                          sizes="80px"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                    </span>
                  </span>
                </span>
                <span className="line-clamp-2 text-[11px] font-bold leading-tight text-fg sm:line-clamp-1 sm:whitespace-nowrap sm:text-[15px]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
