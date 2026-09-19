import { useState } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Sparkle from "../Sparkle/Sparkle.jsx";

/* "Get involved": one card, three ways in, switched by tabs.

   Photograph left, Pollen panel right, and a Pollen Sparkle on the seam
   between them — the panel's own colour, so it reads as the panel
   biting into the photograph rather than as an ornament. Copy AND
   photograph change with the tab, so the whole card is one tabpanel. */

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

export default function GetInvolved({ heading, tabs }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <section className="py-10 md:py-16">
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
              <img
                key={t.key}
                src={t.src}
                alt={t.key === active ? t.alt : ""}
                aria-hidden={t.key !== active}
                loading="lazy"
                decoding="async"
                className={cx(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                  t.key === active ? "opacity-100" : "opacity-0"
                )}
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
            <div role="tablist" aria-label={heading} className="flex flex-wrap gap-6">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`get-involved-tab-${t.key}`}
                  aria-selected={t.key === active}
                  aria-controls="get-involved-panel"
                  onClick={() => setActive(t.key)}
                  className={cx(
                    "border-b-2 pb-1 font-semibold transition-colors",
                    t.key === active
                      ? "border-trust-blue text-trust-blue"
                      : "border-transparent text-bumble-ink/70 hover:text-trust-blue"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              key={tab.key}
              id="get-involved-panel"
              role="tabpanel"
              aria-labelledby={`get-involved-tab-${tab.key}`}
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
