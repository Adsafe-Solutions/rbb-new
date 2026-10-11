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
   docs/TECHNOLOGY_AUDIT.md — the build refuses anything unlisted. No
   payment provider is allowed: Razorpay (Document 22) was removed, and
   RBB's new provider goes here once it is chosen. */
import { createHash } from "node:crypto";

/* Third-party origins the published pages may use, by what for. From the
   technology audit (docs/TECHNOLOGY_AUDIT.md): fonts only. */
export const APPROVED_ORIGINS = {
  style: ["https://fonts.googleapis.com"],
  font: ["https://fonts.gstatic.com"],
  /* Form endpoints (Document 21) are same-origin (/api/forms) and need
     nothing here. A cross-origin endpoint would be listed — after
     approval — and the build refuses one that is not. Resend is called
     server-to-server and never appears in the browser's policy. */
  connect: [],
};
export const approvedOriginList = () => [
  ...new Set(Object.values(APPROVED_ORIGINS).flat()),
];

/* YouTube's privacy-enhanced player — the homepage video (content/
   homepage.js `video`, components/VideoFeature). Allowed as a FRAME only,
   and in only the homepage's own <meta> policy; the site-wide header
   carries it too, because a browser enforces BOTH and a header cannot be
   per page.
   Nothing loads from it until a visitor presses play: the page shows a
   local poster and a button, and the iframe is created on click — so no
   third-party request or cookie on page load (smoke test, Document 17).
   `features` are what the player needs to work as a player (autoplay
   after the click, fullscreen, and picture-in-picture, which it probes
   for and logs a console violation without); Permissions-Policy grants
   exactly those
   to this origin and still denies them to every other one. */
export const VIDEO = {
  frame: ["https://www.youtube-nocookie.com"],
  features: ["autoplay", "fullscreen", "picture-in-picture"],
};
export const VIDEO_ROUTE = "/";

/* The donation provider's widget (Givebutter, M3.5) — allowed ONLY in the
   policy of a page that actually contains a <givebutter-…> element, and
   in the site-wide header only while some page does (a browser enforces
   BOTH, and a header cannot be per page — the same arrangement as VIDEO).
   Today no published page contains one, so the published policy is
   unchanged.

   Exactly what the page itself loads, measured in a browser with the
   real widget (docs/TECHNOLOGY_AUDIT.md):
     script   https://widgets.givebutter.com   the widget library
     connect  https://widgets.givebutter.com   its configuration fetch
              https://givebutter.com           the widget's data fetch
     img      https://givebutter.com           an image it renders
     frame    https://givebutter.com           the checkout itself
   Everything the checkout loads INSIDE its frame (Stripe, Givebutter's
   own analytics, fonts, Turnstile…) is governed by Givebutter's policy,
   not this one, and never runs in this site's document.

   `features`: the checkout frame asks for the Payment Request API (Apple
   Pay / Google Pay); Permissions-Policy grants it to that origin only and
   still denies it everywhere else. */
export const DONATION_WIDGET = {
  provider: "givebutter",
  marker: "<givebutter-",
  script: ["https://widgets.givebutter.com"],
  connect: ["https://widgets.givebutter.com", "https://givebutter.com"],
  img: ["https://givebutter.com"],
  frame: ["https://givebutter.com"],
  features: ["payment"],
};
export const hasDonationWidget = (html) => html.includes(DONATION_WIDGET.marker);

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

/* The policy. `forMeta` drops what a <meta> CSP cannot express. */
/* `images`: the origin(s) a build's published CMS images load from (the
   media library's public domain) — present only when a published snapshot
   brings such images; otherwise the policy is exactly as before. */
export function contentSecurityPolicy({ scripts, styles }, { forMeta = false, video = false, donation = false, images = [] } = {}) {
  const frames = [...(video ? VIDEO.frame : []), ...(donation ? DONATION_WIDGET.frame : [])];
  const extra = (kind) => (donation ? DONATION_WIDGET[kind] : []);
  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", ...extra("script"), ...scripts.map(sha256)],
    [
      "style-src",
      "'self'",
      ...APPROVED_ORIGINS.style,
      ...(styles.length ? ["'unsafe-hashes'", ...styles.map(sha256)] : []),
    ],
    ["font-src", "'self'", ...APPROVED_ORIGINS.font],
    ["img-src", "'self'", ...images, ...extra("img")],
    ["connect-src", "'self'", ...APPROVED_ORIGINS.connect, ...extra("connect")],
    ["manifest-src", "'self'"],
    ["media-src", "'none'"],
    ["object-src", "'none'"],
    ["frame-src", ...(frames.length ? frames : ["'none'"])],
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
   as Content-Security-Policy-Report-Only (the discovery step). */
export function securityHeaders(inline, { reportOnly = false, video = false, donation = false, images = [] } = {}) {
  const csp = contentSecurityPolicy(inline, { video, donation, images });
  const permission = (f) => {
    const origins = [
      ...(video && VIDEO.features.includes(f) ? VIDEO.frame : []),
      ...(donation && DONATION_WIDGET.features.includes(f) ? DONATION_WIDGET.frame : []),
    ];
    return origins.length ? `${f}=(self ${origins.map((o) => `"${o}"`).join(" ")})` : `${f}=()`;
  };
  return {
    "/*": {
      [reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"]:
        csp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": PERMISSIONS.map(permission).join(", "),
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
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
