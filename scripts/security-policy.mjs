/* The security policy — Document 20. Builds the Content Security Policy
   and the other response headers from what the built site ACTUALLY needs,
   and nothing more. scripts/prerender.mjs calls it with the inline code it
   has just published, and:

     - writes build-meta/security-headers.json — every header, by path, for
       whoever configures the host (docs/DEPLOYMENT.md, docs/SECURITY.md)
     - puts the CSP into every page as <meta http-equiv>, so it is enforced
       even before the host sends headers (minus frame-ancestors, which a
       <meta> cannot carry — X-Frame-Options and the header do that)
     - FAILS the build if a page loads from an origin not listed below

   No wildcard, no 'unsafe-inline', no 'unsafe-eval'. The two kinds of
   inline code the pages contain are allowed by exact hash only:
     - the one-line `js` class flag in index.html (Document 15), which must
       run before first paint, so it cannot move into the bundle
     - the `style` attributes React renders into the pre-rendered HTML
       (focal points, logo-mark sizes, bar widths). They are allowed via
       'unsafe-hashes' + their sha256 — only those exact declarations; any
       other inline style is blocked. After hydration React sets styles
       through the DOM, which CSP does not restrict.

   Adding a provider (form endpoint, payment, analytics, monitoring, map,
   video…) means adding its origin HERE, in its own approved phase, and to
   docs/TECHNOLOGY_AUDIT.md — the build refuses anything unlisted. The
   payment provider (Razorpay, Document 22) is below, scoped to one page. */
import { createHash } from "node:crypto";

/* Third-party origins the published pages may use, by what for. From the
   technology audit (docs/TECHNOLOGY_AUDIT.md): fonts only. */
export const APPROVED_ORIGINS = {
  style: ["https://api.fontshare.com", "https://fonts.googleapis.com"],
  font: ["https://cdn.fontshare.com", "https://fonts.gstatic.com"],
  /* Form endpoints (Document 21) are same-origin (/api/forms) and need
     nothing here. A cross-origin endpoint would be listed — after
     approval — and the build refuses one that is not. Resend is called
     server-to-server and never appears in the browser's policy. */
  connect: [],
};
export const approvedOriginList = () => [
  ...new Set(Object.values(APPROVED_ORIGINS).flat()),
];

/* Razorpay Checkout — Document 22. Allowed ONLY on the donation page, and
   only in a build where on-page checkout is switched on
   (content/donation.js `checkoutReady`). Every other page keeps the policy
   above, untouched.

   VERIFIED, not guessed (2026-09-24): Checkout was opened under an
   enforced policy in Chromium and every violation recorded. The parent
   page needs exactly these; everything else Checkout loads (its UI,
   fonts, error reporting) runs INSIDE the api.razorpay.com frame under
   Razorpay's own policy, not ours.
     script  checkout.razorpay.com   the Checkout script (lib/donations.js)
             cdn.razorpay.com        its risk-detection bundle
     frame   api.razorpay.com        the payment window
     connect lumberjack.razorpay.com Checkout's telemetry beacons
   Checkout also writes into our page:
     - `style` attributes, set from script (the overlay, frame, backdrop,
       "Test Mode" badge, body scroll lock), with values that vary by
       viewport — hashing cannot follow them, so the donation page alone
       takes style-src-attr 'unsafe-inline'. A style attribute cannot run
       script; the page's script policy is unchanged.
     - two fixed <style> blocks, allowed by the exact hash of their text
       below (not 'unsafe-inline'). If Razorpay changes them, Checkout's
       spinner/layout styling is blocked — `npm run check:razorpay`
       compares them against the live checkout.js.
   Re-verify with Razorpay TEST keys and RBB_CSP=report-only before
   launch (docs/DONATIONS.md): real payment flows (UPI, netbanking, 3-D
   Secure) were not exercised without keys. */
export const RAZORPAY = {
  script: ["https://checkout.razorpay.com", "https://cdn.razorpay.com"],
  frame: ["https://api.razorpay.com"],
  connect: ["https://lumberjack.razorpay.com"],
  styleElements: [
    "@keyframes rzp-rot{to{transform: rotate(360deg);}}@-webkit-keyframes rzp-rot{to{-webkit-transform: rotate(360deg);}} .razorpay-container > iframe {min-height: 100%!important;} .razorpay-checkout-frame.razorpay-mobile-layout{max-width:450px !important;height:90vh !important;min-height:0 !important;max-height:900px !important;position:fixed !important;top:50% !important;left:50% !important;transform:translate(-50%,-50%) !important;border-radius:16px !important;overflow:hidden !important;}@media(max-width:450px){.razorpay-checkout-frame.razorpay-mobile-layout{max-width:100% !important;width:100% !important;height:100% !important;max-height:100% !important;top:0 !important;left:0 !important;transform:none !important;border-radius:0 !important;}}",
    "@keyframes rzp-rot{to{transform: rotate(360deg);}}@-webkit-keyframes rzp-rot{to{-webkit-transform: rotate(360deg);}}",
  ],
};
export function razorpayOrigins() {
  return [...RAZORPAY.script, ...RAZORPAY.frame, ...RAZORPAY.connect];
}

/* The page whose policy may carry RAZORPAY. */
export const CHECKOUT_ROUTE = "/get-involved/donate";

const sha256 = (text) =>
  `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/* The value a browser hashes: the attribute's text after entity decoding. */
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/* Every inline executable <script> body and every style="" value in a set
   of HTML documents. JSON-LD blocks are data, never executed, and CSP
   does not apply to them. */
export function collectInline(htmlDocuments) {
  const scripts = new Set();
  const styles = new Set();
  for (const html of htmlDocuments) {
    for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] ?? "";
      if (/\bsrc=/.test(attrs) || /application\/ld\+json/.test(attrs) || !m[2].trim())
        continue;
      scripts.add(m[2]);
    }
    for (const m of html.matchAll(/\sstyle="([^"]*)"/g)) styles.add(decode(m[1]));
    if (/\son[a-z]+="/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) {
      throw new Error(
        'an inline event handler (on…="…") was published; the CSP forbids them — move it into the bundle'
      );
    }
  }
  return { scripts: [...scripts].sort(), styles: [...styles].sort() };
}

/* The policy. `forMeta` drops what a <meta> CSP cannot express.
   `checkout` adds RAZORPAY (the donation page, when checkout is on). */
export function contentSecurityPolicy(
  { scripts, styles },
  { forMeta = false, checkout = false } = {}
) {
  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", ...scripts.map(sha256), ...(checkout ? RAZORPAY.script : [])],
    [
      "style-src",
      "'self'",
      ...APPROVED_ORIGINS.style,
      ...(styles.length ? ["'unsafe-hashes'", ...styles.map(sha256)] : []),
    ],
    /* With checkout: <style>/<link> as before plus Razorpay's two blocks by
       hash; style attributes open (see RAZORPAY). */
    ...(checkout
      ? [
          [
            "style-src-elem",
            "'self'",
            ...APPROVED_ORIGINS.style,
            ...RAZORPAY.styleElements.map(sha256),
          ],
          ["style-src-attr", "'unsafe-inline'"],
        ]
      : []),
    ["font-src", "'self'", ...APPROVED_ORIGINS.font],
    ["img-src", "'self'"],
    ["connect-src", "'self'", ...APPROVED_ORIGINS.connect, ...(checkout ? RAZORPAY.connect : [])],
    ["manifest-src", "'self'"],
    ["media-src", "'none'"],
    ["object-src", "'none'"],
    ["frame-src", ...(checkout ? RAZORPAY.frame : ["'none'"])],
    ["worker-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    /* frame-ancestors only works as a header. No upgrade-insecure-requests:
       every resource is same-origin or an approved https origin (the build
       rejects anything else), so it would add nothing — and it breaks
       plain-http previews and is ignored in report-only mode. */
    ...(forMeta ? [] : [["frame-ancestors", "'none'"]]),
  ];
  return directives.map((d) => d.join(" ")).join("; ");
}

/* Capabilities the site does not use — all denied. Only features browsers
   recognise, so none of them logs a console warning. */
const PERMISSIONS = [
  "accelerometer",
  "autoplay",
  "camera",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "usb",
  "xr-spatial-tracking",
];

/* Every header, by path pattern, for the host. `reportOnly` sends the CSP
   as Content-Security-Policy-Report-Only (the discovery step).

   `checkout`: hosts cannot reliably give one path a different CSP header
   (most ADD the headers of every matching rule, and two CSP headers both
   apply), so with checkout on, the HEADER is the donation page's wider
   policy for every path — and each page's own <meta> policy, which the
   browser enforces as well, keeps every other page exactly as strict as
   before. Also with checkout: Cross-Origin-Opener-Policy relaxes to
   same-origin-allow-popups, because some payment methods open a window
   from Checkout that must be able to report back. */
export function securityHeaders(inline, { reportOnly = false, checkout = false } = {}) {
  const csp = contentSecurityPolicy(inline, { checkout });
  return {
    "/*": {
      [reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"]:
        csp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": PERMISSIONS.map((f) => `${f}=()`).join(", "),
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": checkout ? "same-origin-allow-popups" : "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "no-cache",
    },
    "/assets/*": {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    /* Only on the production HTTPS domain, once HTTPS is confirmed on the
       whole domain (docs/SECURITY.md). No includeSubDomains or preload
       until every subdomain is verified. Never on previews or localhost. */
    productionHttpsOnly: {
      "Strict-Transport-Security": "max-age=31536000",
    },
  };
}
