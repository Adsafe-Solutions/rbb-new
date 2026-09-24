/* Reads the Vite env once, in one place, so nothing else in src/ touches
   `import.meta.env` directly.

   "" and undefined both mean "not set", so an env file can list a key it does
   not want to override without blanking the default behind it. */
const env = import.meta.env;

const pick = (value, fallback) =>
  value === undefined || value === "" ? fallback : value;

const bool = (value, fallback) =>
  value === undefined || value === "" ? fallback : value === "true";

/* Hosts that can never be RBB's real site: local machines and the
   domains reserved for documentation and testing (RFC 2606 / 6761). */
const RESERVED_HOST =
  /(^localhost$|^127\.|^0\.0\.0\.0$|\.localhost$|(^|\.)example\.(com|org|net)$|\.(example|invalid|test|local)$)/i;

/* The production origin — "https://host", nothing after it — or null.
   Only an https origin on a real host counts. Everything that makes an
   absolute URL (canonical tags, og:url, social images, structured data,
   the sitemap) is switched off while this is null, so a guessed or
   stand-in domain can never end up published as the canonical site. */
const origin = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (RESERVED_HOST.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/* Whether this BUILD may contain the dev tools (/design-system,
   /components) at all — a compile-time constant, so a production build
   without the switches drops their code, and the catalogue's sample data
   and images, from the output entirely rather than shipping them as
   unrouted but downloadable files (Document 20). Kept separate from ENV
   below because the bundler can only remove code behind a plain constant. */
export const DEV_TOOLS_IN_BUILD =
  env.DEV ||
  env.VITE_DESIGN_SYSTEM_ROUTE === "true" ||
  env.VITE_COMPONENTS_ROUTE === "true";

/* Whether this BUILD can contain the on-page donation checkout (Document
   22) at all — a compile-time constant, like DEV_TOOLS_IN_BUILD, so a
   build without VITE_DONATIONS_API carries no checkout code and no
   Razorpay address in its bundle. Whether the checkout then SHOWS is
   content/donation.js `checkoutReady`. */
export const DONATIONS_IN_BUILD = Boolean(import.meta.env.VITE_DONATIONS_API);

export const ENV = {
  name: pick(env.VITE_ENVIRONMENT, "dev"),
  /* True only in a production BUILD (vite build), never on the dev
     server — one of the conditions optional measurement needs
     (config/observability.js, Document 17). */
  productionBuild: Boolean(env.PROD),
  /* VITE_SITE_URL, if it is a verified production origin (see `origin`).
     Unset in every env file until RBB confirms the domain. */
  siteOrigin: origin(env.VITE_SITE_URL),

  /* Feature switches — see config/sections.js for what each one picks.
     `undefined` here means "leave the default alone", which is why these
     do not carry fallbacks of their own. */
  designSystemRoute:
    env.VITE_DESIGN_SYSTEM_ROUTE === undefined || env.VITE_DESIGN_SYSTEM_ROUTE === ""
      ? undefined
      : bool(env.VITE_DESIGN_SYSTEM_ROUTE),
  componentsRoute:
    env.VITE_COMPONENTS_ROUTE === undefined || env.VITE_COMPONENTS_ROUTE === ""
      ? undefined
      : bool(env.VITE_COMPONENTS_ROUTE),

  /* Where each form submits — Document 12. A PUBLIC address only: a
     same-origin path ("/api/contact") or an https:// URL of RBB's own
     backend. Everything in a VITE_ variable is compiled into the bundle
     every visitor downloads, so no API key, provider secret or recipient
     address ever goes here; those live on the server behind the endpoint.
     Unset means the form stays disabled. */
  formEndpoints: {
    contact: pick(env.VITE_FORM_ENDPOINT_CONTACT, null),
    volunteer: pick(env.VITE_FORM_ENDPOINT_VOLUNTEER, null),
    partner: pick(env.VITE_FORM_ENDPOINT_PARTNER, null),
    fundraise: pick(env.VITE_FORM_ENDPOINT_FUNDRAISE, null),
    newsletter: pick(env.VITE_FORM_ENDPOINT_NEWSLETTER, null),
  },

  /* Where the donation endpoints live — Document 22. Normally the
     same-origin path "/api/donations". PUBLIC, like the form endpoints:
     every Razorpay secret, the currency and the amounts stay on the
     server, which the page asks at run time (GET <this>/config). Unset
     means the donation page has no checkout at all. */
  donationsApi: pick(env.VITE_DONATIONS_API, null),
};

export default ENV;
