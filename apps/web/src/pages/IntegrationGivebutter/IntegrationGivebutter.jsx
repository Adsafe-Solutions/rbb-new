import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Container from "../../components/Container/Container.jsx";
import DonationCheckout from "../../integrations/donations/DonationCheckout.jsx";
import { GIVEBUTTER_ACCOUNT_ID } from "../../config/env.js";

/* INTERNAL — the Givebutter integration spike (M3.5). A development-only
   route, like /design-system: it is never pre-rendered, never linked,
   `noindex`, and a production build without the dev switches does not
   contain it (vite.config.js, scripts/production-gate.mjs). Remove it once
   the donation experience uses DonationCheckout for real.

   It renders the real Givebutter checkout for the first test widget, plus
   enough status to verify the integration: the library loaded once, the
   widget upgraded, navigation away and back. */

/* The first test widget, from the Givebutter dashboard. Only this page
   knows it; the components take it as configuration. */
const TEST_CHECKOUT = { provider: "givebutter", widgetType: "form", widgetId: "jNKkQk" };

function useIntegrationFacts() {
  const [facts, setFacts] = useState({ scripts: 0, widgets: 0, upgraded: false, frames: 0 });
  useEffect(() => {
    const read = () =>
      setFacts({
        scripts: document.querySelectorAll("script[data-givebutter-library]").length,
        widgets: document.querySelectorAll("givebutter-widget").length,
        upgraded: Boolean(window.customElements?.get("givebutter-widget")),
        frames: document.querySelectorAll("givebutter-widget iframe").length,
      });
    read();
    const timer = setInterval(read, 500);
    return () => clearInterval(timer);
  }, []);
  return facts;
}

export default function IntegrationGivebutter() {
  const [status, setStatus] = useState("loading");
  const facts = useIntegrationFacts();
  const rows = [
    ["Account id configured", GIVEBUTTER_ACCOUNT_ID ? "yes" : "no — set VITE_GIVEBUTTER_ACCOUNT_ID"],
    ["Widget id", TEST_CHECKOUT.widgetId],
    ["Library", status],
    ["Library scripts in document", String(facts.scripts)],
    ["Widget elements", String(facts.widgets)],
    ["Custom element defined", facts.upgraded ? "yes" : "no"],
    ["Widget iframes", String(facts.frames)],
  ];

  return (
    <section data-tone="paper" className="py-12 md:py-16">
      <Container>
        <p className="type-meta text-quiet">Internal · integration test · not a public page</p>
        <h1 className="type-title mt-4">Givebutter integration</h1>
        <dl className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-2 text-copy" data-testid="givebutter-status">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold">{label}</dt>
              <dd data-fact={label}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 flex gap-6 text-copy">
          <Link to="/" className="underline">
            Home (navigation test)
          </Link>
          <Link to="/appeals" className="underline">
            Appeals (navigation test)
          </Link>
        </p>
        <div className="mt-10 max-w-xl">
          <DonationCheckout checkout={TEST_CHECKOUT} onStatus={setStatus} />
        </div>
      </Container>
    </section>
  );
}
