/* The analytics interface — Document 17. Components call `pageView` and
   `track`; nothing else in the app knows a provider exists. Today it is a
   no-op: no provider is approved, no adapter is registered, nothing is
   loaded, sent, or stored.

   To activate, once RBB approves a provider, its purposes and its consent
   approach:
     1. set OBSERVABILITY.analytics in config/observability.js
     2. document each event in EVENTS below (purpose, trigger, properties,
        classification, retention) and set its status to "approved"
     3. register the provider's adapter in ADAPTERS — the ONLY place vendor
        code may live — loading its script only after consent where
        consent is required
   An event that is not documented and approved is dropped, whatever the
   provider says.

   ⚠ Never sent, by construction:
     - any property not on the event's allow-list
     - form fields, message text, names, email addresses, phone numbers,
       postal addresses, payment or donation details
     - URL query strings or fragments (they can carry personal data)
   `clean` below enforces the last two for every value that does get
   through. Client-side events are never business truth: a Donate click is
   an intent, never a donation. */
import { OBSERVABILITY, streamEnabled } from "../config/observability.js";

/* The event vocabulary. PROPOSED only (Document 17 §6) — none approved,
   so none is sent. Properties are an allow-list of public identifiers. */
export const EVENTS = {
  page_view: {
    status: "proposed",
    purpose: "Which public pages are read, in aggregate.",
    trigger: "Each client-side route change and the first load.",
    properties: ["route"],
    classification: "Public route identifier; no personal data.",
    retention: null,
  },
  navigation_interaction: {
    status: "proposed",
    purpose: "Whether the header and footer navigation are used.",
    trigger: "Choosing a navigation link.",
    properties: ["route", "target"],
    classification: "Public route identifiers; no personal data.",
    retention: null,
  },
  outbound_link: {
    status: "proposed",
    purpose: "Which external destinations readers follow.",
    trigger: "Following a link off the site.",
    properties: ["route", "host"],
    classification: "Public host name only; no path or query.",
    retention: null,
  },
  cta_interaction: {
    status: "proposed",
    purpose:
      "Use of the main calls to action (e.g. Donate). An intent, never a completed donation.",
    trigger: "Choosing an approved call to action.",
    properties: ["route", "cta"],
    classification: "Public identifiers; no personal or payment data.",
    retention: null,
  },
};

/* Provider adapters — none. One entry per approved provider:
     ADAPTERS.<provider> = { pageView(route), track(name, props) } */
const ADAPTERS = {};

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;

/* A value made safe to send: paths lose their query and fragment, and
   anything shaped like an email address or phone number is replaced. */
const clean = (value) =>
  typeof value === "string"
    ? value
        .split(/[?#]/)[0]
        .replace(EMAIL, "[redacted]")
        .replace(PHONE, "[redacted]")
        .slice(0, 200)
    : typeof value === "number" || typeof value === "boolean"
      ? value
      : undefined;

const adapter = () =>
  streamEnabled("analytics")
    ? (ADAPTERS[OBSERVABILITY.analytics.provider] ?? null)
    : null;

export function track(name, properties = {}) {
  const event = EVENTS[name];
  const send = adapter();
  if (!send || event?.status !== "approved") return;
  const safe = Object.fromEntries(
    event.properties
      .map((key) => [key, clean(properties[key])])
      .filter(([, v]) => v !== undefined)
  );
  send.track(name, safe);
}

export function pageView(route) {
  track("page_view", { route });
}

export default { track, pageView };
