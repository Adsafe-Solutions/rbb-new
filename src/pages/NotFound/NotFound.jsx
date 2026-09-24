import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta } from "../../content/seo.js";

/* Every miss: an unknown URL, and every detail slug that is not an
   approved record. `noindex, nofollow`, no canonical, and the title says
   "Page not found" — never the slug, which would read as a real page. */

export default function NotFound() {
  useSeo(notFoundMeta());

  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-20">
      <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
        404
      </p>
      <h1 className="mt-2 font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
        We cannot find that page
      </h1>
      <p className="mt-4 max-w-prose text-graphite">
        The link may be out of date, or the page may have moved.
      </p>
      <Button to="/" className="mt-8 self-start">
        Back to home
      </Button>
    </Container>
  );
}
