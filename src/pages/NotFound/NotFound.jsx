import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";

export default function NotFound() {
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
