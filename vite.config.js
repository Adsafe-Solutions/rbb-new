import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import contentPublishing from "./scripts/content-publishing.mjs";

/* Tailwind v4 is a Vite plugin, not a PostCSS step — there is no
   tailwind.config.js and no postcss.config.js in this project. The theme lives
   in CSS, at src/styles/theme.css, and that file is the single source of truth
   for every colour, size and radius the site can use.

   The production build is three steps (package.json "build"): this client
   build, the same app built for Node (`--ssr src/entry-server.jsx`), and
   scripts/prerender.mjs, which renders every public route to static HTML
   and writes robots.txt / sitemap.xml from src/content/seo.js
   (Documents 14–15).

   `contentPublishing` (Document 18) runs in every BUILD, client and SSR:
   it removes non-approved records from the content collections before
   bundling, so drafts can never ship. The dev server does not run it. */
/* The dev tools (/design-system, /components) in a build that does not
   include them (Document 20): their page modules are replaced by an empty
   stub, so the catalogue's sample data and legacy images never enter the
   module graph — not even as unreferenced files in dist/. Same condition
   as DEV_TOOLS_IN_BUILD in src/config/env.js. */
function omitDevTools(included) {
  const DEV_PAGES = /\/pages\/(Components\/Components|DesignSystem\/DesignSystem)\.jsx$/;
  const STUB = "\0rbb-dev-tool-omitted";
  return {
    name: "rbb-omit-dev-tools",
    apply: "build",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (included || !importer) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      return resolved && DEV_PAGES.test(resolved.id) ? STUB : null;
    },
    load: (id) => (id === STUB ? "export default null;" : null),
  };
}

/* The donation checkout's NETWORK side (Document 22) in a build without
   VITE_DONATIONS_API: src/lib/donations.js — the fetch calls to the
   donation endpoints and the Razorpay Checkout loader — is replaced by an
   inert module that never makes a request, so no endpoint code and no
   Razorpay address ship in a build that cannot use them. Same condition
   as DONATIONS_IN_BUILD in src/config/env.js.

   Only the network module is replaced, not the DonationCheckout
   component: while giving is pending the donation page draws the form as
   a no-payment PREVIEW (content/donation.js `donationPreview`), and that
   needs the component's markup. Replacing the whole component here was
   why no build ever showed a donation form. */
const INERT_DONATIONS = `
export const CHECKOUT_SRC = null;
export const validApi = () => false;
export const donationConfig = async () => null;
export const createOrder = async () => ({ outcome: "error" });
export const verifyPayment = async () => "unknown";
export const donationStatus = async () => "unknown";
export const loadCheckout = async () => null;
export const newAttemptKey = () => "";
`;
function omitDonationNetwork(included) {
  const NETWORK = /\/src\/lib\/donations\.js$/;
  const STUB = "\0rbb-donation-network-omitted";
  return {
    name: "rbb-omit-donation-network",
    apply: "build",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (included || !importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && NETWORK.test(resolved.id) ? STUB : null;
    },
    load: (id) => (id === STUB ? INERT_DONATIONS : null),
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  const devTools =
    command === "serve" ||
    env.VITE_DESIGN_SYSTEM_ROUTE === "true" ||
    env.VITE_COMPONENTS_ROUTE === "true";
  return {
    plugins: [
      omitDevTools(devTools),
      omitDonationNetwork(command === "serve" || Boolean(env.VITE_DONATIONS_API)),
      contentPublishing({ root: import.meta.dirname }),
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      open: false,
      /* `npm run dev` shows the whole site, forms included, so the forms
         need somewhere to post. /api goes to the local server
         (`npm run serve:local`, port 5190) — the same handler production
         runs, in EMAIL_MODE=test. With that server not running a
         submission fails and the form shows its error message, which is
         the honest outcome: nothing was received. */
      proxy: { "/api": { target: "http://localhost:5190", changeOrigin: false } },
    },
    build: {
      /* Documents are always real files, never inlined as data: URLs —
         the content guard refuses data: links (Document 20), and a
         download link should point at a file. */
      assetsInlineLimit: (file) => (file.endsWith(".pdf") ? false : undefined),
    },
  };
});
