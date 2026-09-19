import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* A full-bleed photographic hero with the title set over it — the inner
   page treatment the reference uses for Volunteer.

   Type over a photograph sits on a gradient, never a flat scrim. Pulls
   itself up under the fixed header exactly as Hero does; see the note
   there. */
export default function BannerHero({ heading, body, src, alt }) {
  return (
    <section className="relative -mt-[var(--header-h)] isolate overflow-hidden bg-bumble-ink text-paper-white">
      <img
        src={src}
        alt={alt}
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-bumble-ink/80 via-bumble-ink/30 to-bumble-ink/20"
      />

      <Container className="flex min-h-[28rem] flex-col justify-end pb-16 pt-[calc(var(--header-h)+4rem)] md:min-h-[34rem] md:pb-24">
        <h1
          className={cx(
            "reveal font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg text-paper-white",
            "md:text-[length:clamp(3.5rem,5vw,4.5rem)]"
          )}
        >
          {heading}
        </h1>
        {body && (
          <p className="reveal mt-4 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
            {body}
          </p>
        )}
      </Container>
    </section>
  );
}
