import { useRef } from "react";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* Quotes in a horizontal strip with previous/next controls.

   Native scroll-snap does the carousel: the strip is a real scroller, so
   touch, trackpad and keyboard all work without JS, and the buttons just
   nudge scrollLeft by one card. No index state to fall out of sync. */

function Arrow({ flip }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("h-5 w-5", flip && "rotate-180")}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Testimonials({ heading, items }) {
  const strip = useRef(null);

  const nudge = (dir) => {
    const el = strip.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className="py-20 md:py-32">
      <Container>
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
          <div className="flex gap-2">
            {[
              ["Previous", -1],
              ["Next", 1],
            ].map(([label, dir]) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => nudge(dir)}
                className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-bumble-ink transition-colors hover:bg-trust-blue hover:text-paper-white"
              >
                <Arrow flip={dir < 0} />
              </button>
            ))}
          </div>
        </div>

        <ul
          ref={strip}
          className={cx(
            "reveal mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {items.map((item) => (
            <li
              key={item.name}
              className="flex w-[85%] shrink-0 snap-start flex-col rounded-3xl bg-mist p-8 sm:w-[60%] lg:w-[calc((100%-3rem)/3)]"
            >
              <span aria-hidden="true" className="font-bold text-[length:var(--text-heading-lg)] leading-none">
                &rdquo;
              </span>
              <blockquote className="mt-2 flex-1">{item.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-4">
                <img
                  src={item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <cite className="font-semibold not-italic">{item.name}</cite>
              </figcaption>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
