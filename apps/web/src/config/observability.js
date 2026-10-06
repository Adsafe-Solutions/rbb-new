/* Observability — Document 17. What the site COULD measure, kept apart
   from what RBB has APPROVED to collect. Every stream is off, and none
   names a vendor: choosing one, its purpose, its consent approach and its
   retention is RBB's decision, after legal/privacy review.

   Four separate streams — never merged into one collection system — each
   with its own purpose and retention once approved:
     analytics     page views and a few documented events (lib/analytics.js)
     errors        runtime error categories (components/ErrorBoundary)
     performance   field Core Web Vitals
     uptime        an external check of a public page
   Search Console is listed too, though it is not visitor measurement: it
   is a site-management service, verified once the domain is confirmed.

   ⚠ Nothing optional may run until its stream is approved here AND the
   environment allows it (see `streamEnabled`). No session replay,
   heatmaps, advertising or remarketing pixels — not listed, not allowed.

   ⚠ No secrets here or in any VITE_* variable: this file ships to every
   browser. A provider's PUBLIC site identifier may go in configuration;
   an API key never does.

   When a stream is approved, record on it:
     status: "approved", provider, purpose, dataClassification,
     retention, access (who can see the data), region, deletion,
     loadsBeforeConsent: false unless counsel says otherwise
   and add the provider to docs/TECHNOLOGY_AUDIT.md. */

import { ENV } from "./env.js";

const off = (purpose) => ({
  status: "not-approved",
  provider: null,
  purpose,
  dataClassification: null,
  retention: null,
  access: null,
  region: null,
});

export const OBSERVABILITY = {
  analytics: off("Aggregate page views and a small set of documented interactions."),
  errors: off(
    "Runtime error categories and the route they occurred on — no messages with personal data, no form contents."
  ),
  performance: off(
    "Field Core Web Vitals (LCP, INP, CLS) against the Document 15 targets."
  ),
  uptime: off(
    "Availability of a public page from an external checker. Needs no visitor data."
  ),
  searchConsole: {
    ...off("Indexing, sitemap and coverage diagnostics. Not visitor analytics."),
    /* The verification method (DNS record, file or meta tag) is chosen with
       the host; none is added before the production domain is confirmed. */
    verification: null,
  },
};

/* Where optional measurement may ever run: a production build, deployed
   as production (VITE_ENVIRONMENT=prod), on the verified production
   origin. Development and preview builds can never send data — even with
   a provider configured — so a preview cannot pollute production figures
   and a dev machine cannot use a production identifier by accident. */
export const measurementEnvironment = () =>
  ENV.productionBuild && ENV.name === "prod" && Boolean(ENV.siteOrigin);

/* One stream's effective state. Approval alone is not enough, and the
   environment alone is not enough: both, plus a named provider. */
export const streamEnabled = (name) => {
  const stream = OBSERVABILITY[name];
  return Boolean(
    stream && stream.status === "approved" && stream.provider && measurementEnvironment()
  );
};

/* The whole picture as one plain object — written into the build
   (build-meta/observability.json) so anyone can verify what a given build
   would do without reading the source. */
export const observabilityReport = () =>
  Object.fromEntries(
    Object.entries(OBSERVABILITY).map(([name, s]) => [
      name,
      { status: s.status, provider: s.provider, enabledInThisBuild: streamEnabled(name) },
    ])
  );

export default OBSERVABILITY;
