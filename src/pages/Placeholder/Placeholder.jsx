import { useLocation } from "react-router-dom";
import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";

/* The stub behind every nav and footer link that has no page yet.

   It exists so the header never shows a link that 404s. A route that lands
   here is unbuilt, not broken, and the copy says so rather than implying
   something went wrong. */
export default function Placeholder() {
  const { pathname } = useLocation();

  /* "/member-circle" → "Member circle". The path is the only thing this
     page knows about itself, so it is also the title. */
  const title = pathname
    .replace(/^\//, "")
    .replace(/-/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-20">
      <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
        {title || "Coming soon"}
      </h1>
      <p className="mt-4 max-w-prose text-graphite">This page has not been built yet.</p>
      <Button to="/" className="mt-8 self-start">
        Back to home
      </Button>
    </Container>
  );
}
