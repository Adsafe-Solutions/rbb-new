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

/* The runtime snapshot (docs/PUBLISHING.md "Runtime snapshot"): compiled
   in by scripts/vite-published-snapshot.mjs for a build that applied a
   published snapshot and may ask the API for a newer one in the browser —
   { url, version, orgId, timeoutMs }, public values only — or null:
   the site is then fully static. Read by src/lib/runtimeBoot.js. */
const runtimeSnapshot = (value) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed.url === "string" && Number.isInteger(parsed.version) ? parsed : null;
  } catch {
    return null;
  }
};

export const ENV = {
  name: pick(env.VITE_ENVIRONMENT, "dev"),
  /* True during the build's pre-render (and any Node loader), false in a
     browser: the runtime snapshot is never fetched outside a browser. */
  ssr: Boolean(env.SSR),
  runtimeSnapshot: runtimeSnapshot(env.VITE_RBB_RUNTIME_SNAPSHOT),
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
  /* The colour-theme switcher (components/ThemeSwitcher). Off unless a
     deployment sets VITE_THEME_SWITCHER=true. */
  themeSwitcher: bool(env.VITE_THEME_SWITCHER, false),
  /* The announcement bar and the on-screen popup (content/
     announcements.js). Unset: the content file's own `enabled` decides. */
  announcementBar: env.VITE_ANNOUNCEMENT_BAR ? bool(env.VITE_ANNOUNCEMENT_BAR) : undefined,
  sitePopup: env.VITE_SITE_POPUP ? bool(env.VITE_SITE_POPUP) : undefined,
  /* The story circles over the navbar (content/appeals.js STORIES). */
  storyStrip: env.VITE_STORY_STRIP ? bool(env.VITE_STORY_STRIP) : undefined,

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
    travel: pick(env.VITE_FORM_ENDPOINT_TRAVEL, null),
    fundraise: pick(env.VITE_FORM_ENDPOINT_FUNDRAISE, null),
    newsletter: pick(env.VITE_FORM_ENDPOINT_NEWSLETTER, null),
  },
};

/* The donation provider's PUBLIC account identifier — what its widget
   library is loaded with (src/integrations/givebutter). Not a secret: it
   appears in every page that shows a widget. The provider's API key never
   comes anywhere near the browser; it lives on the API server. A separate
   export (not part of ENV) so a build with no widget carries nothing. */
export const GIVEBUTTER_ACCOUNT_ID = env.VITE_GIVEBUTTER_ACCOUNT_ID || null;

export default ENV;
