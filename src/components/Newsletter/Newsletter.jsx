import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import { FORMS } from "../../content/index.js";
import Sparkle from "../Sparkle/Sparkle.jsx";
import Picture from "../Picture/Picture.jsx";

/* The newsletter card: copy left, photograph right, the whole card
   sitting half on the page and half on a Light Gray band beneath it.

   ⚠ No form. It used to have one that "confirmed in place" — said
   "Thanks — you're on the list." and sent the address nowhere. Nobody was
   on any list. Until RBB approves a newsletter provider, privacy wording
   and data handling (Document 07), the card states that sign-up is not yet
   available (`pending`) instead. The form returns through FormShell only
   when the newsletter config is ready — which also needs approved consent
   wording and a real privacy policy (Document 12). Nothing is ever stored
   in the browser. */

/* RBB (Document 26 promotion): `kicker` over the heading; the form uses
   FormShell's inline layout — the design's one-line email + send button —
   with the real newsletter configuration, so it is live only when that
   config is (consent wording, Privacy Policy, endpoint). */
export default function Newsletter({ kicker, heading, body, pending, src, alt, focal, form = FORMS.newsletter }) {

  return (
    <section className="relative py-20 md:py-32">
      {/* The band the card straddles: the lower half of the section. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-mist" />

      <Container className="relative">
        <div className="reveal grid overflow-hidden rounded-3xl bg-paper-white shadow-sm md:grid-cols-[6fr_5fr]">
          <div className="flex flex-col justify-center px-8 py-12 md:px-14 md:py-20">
            {kicker && (
              <p className="mb-4 flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
                <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
                {kicker}
              </p>
            )}
            <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
              {heading}
            </h2>
            {body && <p className="mt-4 max-w-prose text-graphite">{body}</p>}

            {/* No form until there is somewhere real to send it — see
                the note above. Until `form` is ready (content/forms.js)
                the pending line takes its place. */}
            <FormShell
              config={form}
              layout="inline"
              className="mt-8 max-w-lg"
              fallback={
                pending && (
                  <p className="mt-8 max-w-lg rounded-2xl bg-mist px-6 py-4 font-medium text-bumble-ink">
                    {pending}
                  </p>
                )
              }
            />
          </div>

          {/* At least 28rem, and otherwise as tall as the copy beside it —
              the photograph is absolutely placed inside, so its own
              aspect ratio never sets the card's height. */}
          <div className="relative aspect-[4/3] rounded-tl-[5rem] md:aspect-auto md:min-h-[28rem]">
            <Picture
              sizes="(min-width: 768px) 40vw, 100vw"
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full rounded-tl-[5rem] object-cover"
              style={focal ? { objectPosition: focal } : undefined}
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
