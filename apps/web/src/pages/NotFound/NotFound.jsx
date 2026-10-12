import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";
import Mark from "../../components/Mark/Mark.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta } from "../../content/seo.js";
import { SITE } from "../../content/index.js";
import { snapshotState } from "../../lib/runtimeBoot.js";

/* Every miss: an unknown URL, and every detail slug that is not an
   approved record. `noindex, nofollow`, no canonical, and the title says
   "Page not found" — never the slug, which would read as a real page.

   Set as a poster like every other first screen: "404" in display type
   on the accent, the mark enormous and faint behind it.

   One honest exception (runtime snapshot, src/lib/runtimeBoot.js): an
   address the build did not pre-render, reached while the API could not
   be asked for the latest published content and the browser held none.
   A page published since the build may exist there; the site cannot know.
   It says that — "cannot be shown right now", with a retry — rather than
   "not found", and never shows invented content. Still noindex. */

export default function NotFound() {
  useSeo(notFoundMeta());
  const runtime = snapshotState();
  const unavailable = !runtime.prerendered && runtime.status === "unavailable";
  const copy = unavailable ? SITE.unavailable : SITE.notFound;

  return (
    <section data-tone="paper" className="relative -mt-[var(--header-h)] overflow-clip pt-[var(--header-h)]">
      <Mark className="pointer-events-none absolute -right-[10%] top-[6%] h-[min(90vw,40rem)] w-[min(90vw,40rem)] rotate-[8deg] text-fg opacity-[0.05]" />
      <Container className="relative flex min-h-[70vh] flex-col justify-center py-20">
        <p className="type-meta text-quiet">
          <span className="hl type-title">{unavailable ? "Unavailable" : "404"}</span>
        </p>
        <h1 className="type-billboard mt-8 max-w-[14ch]" {...(unavailable && { role: "alert" })}>{copy.heading}</h1>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{copy.body}</p>
        {unavailable ? (
          <Button size="lg" onClick={() => window.location.reload()} className="mt-9 self-start">
            {copy.cta.label}
          </Button>
        ) : (
          <Button size="lg" to={copy.cta.to} className="mt-9 self-start">
            {copy.cta.label}
          </Button>
        )}
      </Container>
    </section>
  );
}
