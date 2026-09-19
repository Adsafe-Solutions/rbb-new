import { useState } from "react";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import Sparkle from "../Sparkle/Sparkle.jsx";

/* The newsletter card: form left, photograph right, the whole card
   sitting half on the page and half on a Light Gray band beneath it.

   Nothing is sent anywhere yet — the form only validates and confirms in
   place, so a mail provider is a drop-in behind `onSubmit`.

   The send control is Growth Green, the system's one filled button
   colour; the band beneath the card is Light Gray. */

function SendIcon() {
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
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

export default function Newsletter({ heading, body, consent, src, alt }) {
  const [done, setDone] = useState(false);

  return (
    <section className="relative py-20 md:py-32">
      {/* The band the card straddles: the lower half of the section. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-mist" />

      <Container className="relative">
        <div className="reveal grid overflow-hidden rounded-3xl bg-paper-white shadow-sm md:grid-cols-[6fr_5fr]">
          <div className="flex flex-col justify-center px-8 py-12 md:px-14 md:py-20">
            <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
              {heading}
            </h2>
            {body && <p className="mt-4 max-w-prose text-graphite">{body}</p>}

            {done ? (
              <p className="mt-8 rounded-2xl bg-mist px-6 py-4 font-medium">
                Thanks — you're on the list.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setDone(true);
                }}
                className="mt-8 flex max-w-lg flex-col gap-4"
              >
                <label className="flex items-center gap-3 rounded-2xl border border-mist p-2 pl-6 focus-within:border-bumble-ink">
                  <span className="sr-only">Email address</span>
                  <input
                    type="email"
                    required
                    placeholder="Your Email"
                    className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-graphite/70"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe"
                    className={cx(
                      "grid h-14 w-16 shrink-0 place-items-center rounded-2xl",
                      "bg-growth-green text-paper-white transition-colors hover:bg-trust-blue"
                    )}
                  >
                    <SendIcon />
                  </button>
                </label>
                <label className="flex items-start gap-3 text-graphite">
                  <input type="checkbox" required className="mt-1.5 h-4 w-4 accent-bumble-ink" />
                  {consent}
                </label>
              </form>
            )}
          </div>

          {/* Fixed height, not min-height — a portrait photograph would
              otherwise set the card's height from its own aspect ratio. */}
          <div className="relative aspect-[4/3] rounded-tl-[5rem] md:aspect-auto md:h-[28rem]">
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-tl-[5rem] object-cover"
            />
            {/* Centred on the seam — the top edge when stacked, the left
                edge side by side — in the card's own white, so it reads
                as the panel biting into the photograph. */}
            <Sparkle
              className={cx(
                "absolute z-10 w-20 text-paper-white",
                "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
                "md:left-0 md:top-1/2 md:w-32 md:-translate-x-1/2 md:-translate-y-1/2"
              )}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
