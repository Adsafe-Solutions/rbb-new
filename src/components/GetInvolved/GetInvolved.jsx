import { useId, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Sparkle from "../Sparkle/Sparkle.jsx";
import Picture from "../Picture/Picture.jsx";

/* "Get involved": one card, three ways in, switched by tabs.

   Photograph left, Pollen panel right, and a Pollen Sparkle on the seam
   between them — the panel's own colour, so it reads as the panel
   biting into the photograph rather than as an ornament. Copy AND
   photograph change with the tab, so the whole card is one tabpanel.

   Keyboard (WAI-ARIA tabs): Tab reaches the selected tab only; Left/Right
   (and Home/End) move between tabs and select them; Tab again goes into
   the panel. Ids come from useId, so the section can appear twice.

   Without JavaScript the first tab's panel is what the pre-rendered page
   shows — a complete section on its own, with its own link. */

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function GetInvolved({ heading, tabs, id }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  const uid = useId();
  const tabId = (key) => `${uid}-tab-${key}`;
  const panelId = `${uid}-panel`;
  const buttons = useRef({});

  const onKeyDown = (event) => {
    const i = tabs.findIndex((t) => t.key === active);
    const next =
      event.key === "ArrowRight"
        ? tabs[(i + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(i - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    setActive(next.key);
    buttons.current[next.key]?.focus();
  };

  return (
    <section id={id} className="scroll-mt-[var(--header-h)] py-10 md:py-16">
      <Container>
        <h2 className="reveal font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          {heading}
        </h2>

        <div
          className={cx(
            "reveal mt-8 grid overflow-hidden rounded-3xl bg-pollen",
            "md:grid-cols-[2fr_3fr] md:rounded-br-[5rem]"
          )}
        >
          {/* Every tab's photograph stays mounted and only its opacity
              changes — swapping one <img>'s src would flash blank while
              the next file loads, which is the "jump" a crossfade is
              there to remove.

              No overflow-hidden here: the Sparkle hangs half outside this
              column, on the seam, and the card's own clip does the
              cornering. */}
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[30rem]">
            {tabs.map((t) => (
              <Picture
                key={t.key}
                sizes="(min-width: 768px) 40vw, 100vw"
                src={t.src}
                alt={t.key === active ? t.alt : ""}
                aria-hidden={t.key !== active}
                loading="lazy"
                decoding="async"
                className={cx(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                  t.key === active ? "opacity-100" : "opacity-0"
                )}
                style={t.focal ? { objectPosition: t.focal } : undefined}
              />
            ))}

            {/* Centred on the seam: the bottom edge when stacked, the
                right edge side by side. The SAME colour as the panel, so
                the half over the panel disappears and the half over the
                photograph reads as the panel biting into the picture. */}
            <Sparkle
              className={cx(
                "absolute z-10 w-20 text-pollen",
                "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                "md:bottom-auto md:left-auto md:right-0 md:top-1/2 md:w-32",
                "md:translate-x-1/2 md:-translate-y-1/2"
              )}
            />
          </div>

          <div className="px-6 py-12 md:px-16 md:py-20">
            <div role="tablist" aria-label={heading} className="flex flex-wrap gap-x-6 gap-y-3" onKeyDown={onKeyDown}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  ref={(el) => (buttons.current[t.key] = el)}
                  id={tabId(t.key)}
                  aria-selected={t.key === active}
                  aria-controls={panelId}
                  tabIndex={t.key === active ? 0 : -1}
                  onClick={() => setActive(t.key)}
                  className={cx(
                    "border-b-2 pb-1 font-semibold transition-colors",
                    t.key === active
                      ? "border-trust-blue text-trust-blue"
                      : "border-transparent text-bumble-ink/80 hover:text-trust-blue"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              key={tab.key}
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId(tab.key)}
              className="enter mt-10"
            >
              <h3 className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
                {tab.heading}
              </h3>
              <p className="mt-4 max-w-prose">{tab.body}</p>
              {tab.cta && (
                <Button to={tab.cta.to} className="mt-8">
                  {tab.cta.label}
                  <ArrowIcon />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
