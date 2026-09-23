import { useRef } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A programme with its options: heading and intro, then a strip of photo
   cards — each with a title, its copy, and an optional detail line and
   link. Three or fewer sit in a grid; more become a scroll-snap strip
   with previous/next, the same mechanism as Testimonials. */

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

export default function OptionStrip({ heading, intro, items, surface = "paper" }) {
  const strip = useRef(null);
  const scrolls = items.length > 3;

  const nudge = (dir) => {
    const el = strip.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className={cx("py-16 md:py-24", surface === "mist" && "bg-mist")}>
      <Container>
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg [overflow-wrap:anywhere]">
              {heading}
            </h2>
            {intro && <p className="mt-4 text-graphite">{intro}</p>}
          </div>
          {scrolls && (
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
          )}
        </div>

        <ul
          ref={strip}
          className={cx(
            "reveal mt-10",
            scrolls
              ? "flex snap-x snap-mandatory gap-cards overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "grid gap-cards md:grid-cols-3"
          )}
        >
          {items.map((item) => (
            <li
              key={item.title}
              className={cx(
                "flex flex-col overflow-hidden rounded-3xl",
                surface === "mist" ? "bg-paper-white" : "bg-mist",
                scrolls && "w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-[calc((100%-3rem)/3)]"
              )}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-6 md:p-8">
                <h3 className="font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                  {item.title}
                </h3>
                <p className="mt-3 text-graphite">{item.body}</p>
                {item.detail && (
                  <p className="mt-4 border-l-4 border-bumble-honey pl-3 text-[length:var(--text-caption)] font-semibold tracking-caption">
                    {item.detail}
                  </p>
                )}
                {item.cta && (
                  <Button variant="link" to={item.cta.to} className="mt-auto pt-6">
                    {item.cta.label}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
