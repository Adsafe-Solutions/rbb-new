import { Component } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import { reportError } from "../../lib/monitoring.js";

/* Catches a runtime error in one page so it does not blank the whole site
   (Document 15 §13). The header and footer stay; the page area says, in
   the site's own voice, that something went wrong, and offers the way
   home. Nothing about the error is shown — no message, no stack, no
   configuration — and nothing leaves the browser until an error service
   is approved (lib/monitoring.js).

   `resetKey` is the route: navigating elsewhere clears the error, so one
   broken page does not follow the reader around the site.

   During the build's pre-render an error is NOT caught here —
   renderToString rethrows it, and scripts/prerender.mjs fails the build
   rather than publishing a broken page. */
export default class ErrorBoundary extends Component {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  /* The one reporting hook — a no-op until error monitoring is approved
     (lib/monitoring.js). Category and route only; the error itself is
     never passed on. */
  componentDidCatch() {
    reportError("render", this.props.resetKey);
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  render() {
    const { copy, children } = this.props;
    if (!this.state.failed) return children;
    return (
      <Container className="flex min-h-[60vh] flex-col justify-center py-20">
        <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          {copy.heading}
        </h1>
        <p className="mt-4 max-w-prose text-graphite">{copy.body}</p>
        <Button to="/" className="mt-8 self-start">
          {copy.cta}
        </Button>
      </Container>
    );
  }
}
