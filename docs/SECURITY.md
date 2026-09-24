# Security baseline — Rising Beyond Borders website

Document 20. The concrete security controls in the site, what each one
depends on, and what is still waiting on the production host. **This is an
engineering baseline, not a certification, audit or penetration test**, and
nothing here should be presented publicly as a claim that the site is
"secure".

Last reviewed: 2026-09-24 (Node 25.2.1, npm 11.6.2), against a local
production build. The production host and domain are not yet selected.

## What the site is

Static, pre-rendered HTML with React hydration (Document 15). No
database, CMS, login, cookies, browser storage or analytics. Every form is
disabled (Document 12); donations are closed (Document 11). Server
functions for forms (Document 21) and Razorpay donations (Document 22) are
built and tested but not deployed. Today its attack surface is what a
browser loads from it.

## Implemented in the build

| Control | Where | Status |
| --- | --- | --- |
| Content Security Policy | `scripts/security-policy.mjs` → every page (`<meta http-equiv>`) and `build-meta/security-headers.json` | **Enforced** in every page today |
| No inline event handlers | build fails if one is published | Enforced |
| Unapproved third-party origin | build fails if a page loads from an origin not in `APPROVED_ORIGINS` | Enforced |
| Dev tools (`/components`, `/design-system`) | not in the production build at all — no chunk, no sample data, no legacy images | Enforced |
| Unapproved content | removed at build time (Document 18) | Enforced |
| Executable URLs in content | build fails on any `javascript:`, `vbscript:` or `data:` value | Enforced |
| Source maps | not generated (`build.sourcemap` default off) | Verified — none in `dist/` |
| External links | every `target="_blank"` has `rel="noopener noreferrer"` | Verified |
| Error pages | generic text; no stack, path or configuration (ErrorBoundary, 404) | Verified |

### Content Security Policy

Built from what the pages actually contain — nothing copied from a
template. As of this review:

```
default-src 'self';
script-src 'self' 'sha256-…';              ← the one-line `js` class flag (Document 15)
style-src 'self' https://api.fontshare.com https://fonts.googleapis.com
          'unsafe-hashes' 'sha256-…' ×19;   ← the style="" attributes in the HTML
font-src 'self' https://cdn.fontshare.com https://fonts.gstatic.com;
img-src 'self'; connect-src 'self'; manifest-src 'self';
media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none';
base-uri 'self'; form-action 'self';
frame-ancestors 'none'                      ← header only
```

- **No wildcard, no `'unsafe-inline'`, no `'unsafe-eval'`.**
- **Documented exception — `'unsafe-hashes'` in `style-src`.** React renders
  a few `style` attributes into the pre-rendered HTML (image focal points,
  logo-mark sizes, reveal delays, the financial bar widths). They are
  allowed by the SHA-256 of each exact declaration (19 today, recomputed on
  every build) — any other inline style is blocked. After hydration React
  sets styles through the DOM, which CSP does not restrict. Removing these
  would mean rewriting approved components; the hash list is the narrower
  choice.
- JSON-LD `<script type="application/ld+json">` blocks are data, not
  script, and are unaffected.
- The DM Sans stylesheet's inline `onload` handler (Document 15) was
  replaced by a switch in `src/main.jsx` so no inline handler is needed.
- No `upgrade-insecure-requests`: every resource is same-origin or an
  approved https origin (the build enforces it), so it would add nothing,
  and it breaks plain-http previews.
- The `<meta>` copy omits `frame-ancestors`, which only works as a header;
  `X-Frame-Options` covers older browsers.

**Rollout:** built with `RBB_CSP=report-only`, every page (28 plus the 404
and an unknown slug) was crawled at 1280 px and 375 px, with scrolling, the
mobile menu and client-side navigation: **0 violations**. Then enforced and
re-run: **0 violations, 0 console messages**. Negative tests confirmed an
injected inline script and an unhashed inline style are blocked, a script
from an unapproved origin is blocked, hashed styles still apply (also with
JavaScript off), and framing by another origin is refused.

## Response headers — host-dependent

`build-meta/security-headers.json` lists every header, by path. The host
must send them as HTTP headers (see `docs/DEPLOYMENT.md`); until then only
the `<meta>` CSP is in force.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | as above, including `frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` — full URLs never leave the site; other origins see only the origin |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb, fullscreen and 11 more all `()` — the site uses none. `payment` stays denied: Razorpay Checkout opened without it; re-check in the test-key run (`docs/DONATIONS.md`) |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin`; `same-origin-allow-popups` only in a build with donation checkout on, so payment-method windows can report back (Document 22) |
| `Cross-Origin-Resource-Policy` | `same-origin` — fonts load from their own origins and are unaffected |
| `Cache-Control` | `no-cache` for pages; `public, max-age=31536000, immutable` for `/assets/*` |
| `Strict-Transport-Security` | `max-age=31536000` — **production HTTPS domain only**, after HTTPS is confirmed across the whole domain. No `includeSubDomains` or `preload` until every subdomain is verified. Never on previews or localhost |

All were exercised locally with a test server sending exactly this file's
headers; Chromium reported no header or policy errors.

## Secrets and environment

- Every `VITE_*` variable is **public** — compiled into what every visitor
  downloads. Current ones: `VITE_ENVIRONMENT`, `VITE_SITE_URL`,
  `VITE_DESIGN_SYSTEM_ROUTE`, `VITE_COMPONENTS_ROUTE`,
  `VITE_FORM_ENDPOINT_*`, `VITE_DONATIONS_API` (all public configuration;
  none set to a secret).
- Committed env files: `.env.example`, `.env.development`,
  `.env.production` — public, non-secret values only. `.env.local` and
  `*.local` are ignored.
- **Secret scan (2026-09-24):** source, scripts, config, env files and
  `dist/` searched for AWS/Stripe/GitHub/Slack/Google key shapes, private
  keys, credential assignments, database URLs, credentials in URLs, email
  addresses and local filesystem paths — **none found**.
- Payment keys, email credentials, API tokens, webhook secrets and form
  recipients belong on a server, never in this repository's frontend.

## Dependencies

- **`npm audit` (2026-09-24): 0 vulnerabilities** (full tree and
  production-only).
- Runtime: `react`, `react-dom`, `react-router-dom` — 9 packages in total.
  Build-only: `vite`, `@vitejs/plugin-react`, `tailwindcss`,
  `@tailwindcss/vite`, `prettier`.
- Install scripts: `esbuild` (build tool binary) and `fsevents` (optional,
  macOS) only — both expected, both build-time. The project defines no
  install hooks.
- No dependency was added or upgraded in this phase. Re-run `npm audit`
  before launch and after any dependency change.

## Build output (`dist/`) — inspected 2026-09-24

HTML, one CSS file, the JS bundle, 8 photographs and their WebP copies,
`robots.txt`. **No** source maps or `sourceMappingURL`, `.env`, JSON,
markdown, hidden files, test fixtures, held-back content, dev-tool chunks,
local paths or email addresses. `build-meta/` and `dist-ssr/` are outside
the published folder.

## Client-side review

- No `dangerouslySetInnerHTML` or `innerHTML` in the app. React escapes all
  text.
- The only query parameter read is `/stories?type=…`, used as a lookup key
  against the category list — never rendered.
- Injection tests (query strings, slugs, bare paths, path traversal) with
  an HTML/script payload: nothing executed, no node injected, the payload
  never appears in the DOM; unknown paths render the generic 404.
- Content cannot inject markup: content strings render as text, and link
  fields cannot carry `javascript:`/`data:` URLs (build fails).

## Form submission boundary (Document 21)

Implemented and tested, not yet live (forms stay disabled until the
Privacy Policy, sender domain and recipients are approved):
`server/handler.mjs` validates method, Origin, content type, size, JSON,
fields, lengths, email shape and header-injection attempts server-side;
escapes all visitor text in emails; rate-limits per client + form; discards
honeypot/too-fast submissions silently; sends through Resend
server-to-server; returns generic responses; logs metadata only.
`EMAIL_API_KEY` is server-only — scanned absent from `src/`, `dist/`, the
Vite env files and the repository (including Resend's `re_…` key shape).
**The key shared during planning must be revoked.** 29 automated tests
(`npm run test:server`). Details: `docs/FORMS_AND_EMAIL.md`.

## Payment boundary (Document 22)

Built and tested, **not live** (`docs/DONATIONS.md`). Razorpay order
creation, payment-signature verification and webhook-signature
verification are server-side (`server/donations/`); the browser gets only
the public key id and the approved amount rules. A Checkout "success" is
verified against Razorpay's own order and payment records before anything
is called success; amounts, currency and order ids are never taken from
the browser. Donation routes check method, Origin, content type and size,
are rate-limited, return generic codes only, and log no donor details,
signatures, payloads or secrets. Test and live fail closed and never fall
back to each other. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are
server-only — scanned absent from `src/`, `dist/` and the Vite env files.

CSP: Razorpay's exact origins (verified in the browser, not guessed) are
added to the donation page ONLY, ONLY in a build with checkout on — see the
table in `docs/DONATIONS.md`. That page alone takes `style-src-attr
'unsafe-inline'` (Checkout sets viewport-dependent style attributes from
script) and hashes Razorpay's two `<style>` blocks; its script policy stays
origin- and hash-based. The build fails if any page references a Razorpay
origin directly. **Any other new provider** must be added to
`APPROVED_ORIGINS` (`scripts/security-policy.mjs`) in its own approved
phase, and to `docs/TECHNOLOGY_AUDIT.md` — the build refuses unlisted
origins.

## Deployment boundary (Document 25)

- **Rate limiting fails closed in live mode.** An in-memory limiter spread
  over serverless instances limits nothing. So with `EMAIL_MODE=live` or
  `RAZORPAY_MODE=live`, the endpoint stays off unless the host passes a
  shared limiter (`RATE_LIMIT_STORE=shared`) or confirms a single process
  (`RATE_LIMIT_SINGLE_INSTANCE=true`). See `server/rate-limit.mjs` and its
  tests.
- **Release gate** (`scripts/production-gate.mjs`), in addition to
  Document 24's rules, refuses:
  - development catalogue content
  - `/design-system` and `/components` routes
  - test fixtures (fake keys, `not-real` secrets)
- **Smoke test** (`npm run smoke`) verifies on the deployed host: headers
  sent as HTTP headers, HSTS on https, HTTP → HTTPS, CSP free of wildcards
  and `unsafe-eval`, no cookies or web storage, no unapproved third-party
  requests.
- **The planning Resend key is compromised.** Revoke it; production must
  use a new key held only in the host's secrets.

## Pending the production host

- [ ] HTTPS on the domain; HTTP → HTTPS redirect at the host/CDN.
- [ ] All headers in `build-meta/security-headers.json` sent as HTTP headers; verify with the browser's network panel.
- [ ] HSTS enabled after HTTPS is confirmed domain-wide.
- [ ] 301 redirects from `build-meta/redirects.json`; real 404 status.
- [ ] Host/CDN audit: cookies, injected scripts, analytics, bot-challenge pages (`scripts/audit-technology.mjs`); any origin it adds needs approval and a CSP update.
- [ ] Re-run `npm audit`, the secret scan and the CSP crawl on the deployed site.

No host security feature is claimed until the chosen host is verified.
