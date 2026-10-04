# Deploying the Rising Beyond Borders website

Document 15 — production rendering and deployment assumptions. No host,
CDN or domain has been chosen; nothing below is specific to one. Whoever
configures hosting checks each requirement against the chosen platform.

## Environments (Document 25)

Content is the same everywhere — one source, one build (Document 27).
What changes between environments is INFRASTRUCTURE.

| Environment | Command | Content | Real email | Payments | Indexing |
| --- | --- | --- | --- | --- | --- |
| Development | `npm run dev` (+ `npm run serve:local` for `/api/*`) | The complete site | No — `EMAIL_MODE=test` renders previews, sends nothing | No (`DONATION_ENABLED=false`) | Not deployed |
| Preview | `npm run build`, deployed to a preview URL | The complete site | Test only (`EMAIL_MODE=test` or `staging`) | Razorpay TEST only | No — the host sends `X-Robots-Tag: noindex` |
| Production | `npm run build` | The complete site, with RBB's FINAL approved content (`npm run release:status`) | Only after approval (`EMAIL_MODE=live`) | Only after approval (`RAZORPAY_MODE=live`) | Approved routes only |

**Nothing below chooses a host, domain or DNS provider** — those are RBB
decisions (docs/RELEASE_READINESS.md). The launch-day sequence, smoke
test, rollback and monitoring are in `docs/LAUNCH_RUNBOOK.md`.

**Ownership — record here once decided:**

| Item | Owner / value |
| --- | --- |
| Production domain (`VITE_SITE_URL`) | *not decided* |
| Hosting platform + serverless runtime | *not decided* |
| DNS provider and who changes records | *not decided* |
| TLS certificates (issuer, renewal) | *not decided* (normally the host) |
| Who deploys; who may roll back | *not decided* |
| Incident contact during the monitoring window | *not decided* |
| Hosting account / billing owner | *not decided* |
| Deployment method (CLI, Git integration, CI) | *not decided* |
| Preview deployment model | *not decided* |
| Host-injected analytics, cookies, monitoring or widgets permitted? | *not decided* — default **no** |
| Canonical host: `www.` or apex (the other permanently redirects to it) | *not decided* |
| Runtime model for `/api/*`: serverless · edge · container · long-running | *not decided* — sets the rate-limit configuration |

Host-specific setup, once these are known: `docs/HOST_CONFIGURATION.md`.

## Build

```sh
npm ci
npm run build                 # the site
npm run release:status        # RBB approvals + content readiness (Document 24)
npm run release:package       # the immutable artifact that gets deployed
```

`npm run build` is three steps, and fails (non-zero exit) if any fails:

1. `vite build` — the browser bundle into `dist/` (hashed JS, CSS, images).
2. `vite build --ssr src/entry-server.jsx --outDir dist-ssr` — the same app
   built for Node.
3. `node scripts/prerender.mjs` — renders every public route to static HTML.

The pre-render step **stops the build** if a route throws while rendering,
a public route renders the not-found page or has no `<h1>`, a redirect
alias is also a page, a redirect points at another redirect, or a
placeholder/local domain appears in the output. A deployment that runs
`npm run build` therefore never publishes a partial site — configure the
host to abort on a failed build.

### What `dist/` contains

| Path | What it is |
| --- | --- |
| `index.html`, `<route>/index.html` | One pre-rendered page per public route: content in the HTML, plus its own title, description, robots, canonical, Open Graph / X and JSON-LD tags. The browser then hydrates it. |
| `404.html` | The not-found page (`noindex, nofollow`). |
| `<alias>/index.html` | A forwarding page for each old address (meta refresh, `noindex`) — a fallback only; see Redirects. |
| `assets/*` | Hashed, immutable JS, CSS, images and responsive WebP copies. |
| `robots.txt` | Allows everything; adds `Sitemap:` once the domain is set. |
| `sitemap.xml` | Only when `VITE_SITE_URL` is a verified https origin. |

Outside `dist/`, for whoever configures the host (not published):

- `build-meta/redirects.json` — every permanent redirect, `{ from, to, status: 301 }`.
- `build-meta/routes.json` — every pre-rendered route.
- `build-meta/security-headers.json` — the Content Security Policy and every other security/caching response header, by path (Document 20; see `docs/SECURITY.md`).
- `build-meta/observability.json` — which measurement streams this build would run (all off until approved) and every third-party origin the pages load from (Document 17).

## Host requirements

**Static hosting.** No server code, no backend. Any host that serves files
works if it meets the points below.

**Routing.**
- Serve `/<route>` from `dist/<route>/index.html` **without** redirecting to
  a trailing slash. Canonical URLs have no trailing slash (`/about`, not
  `/about/`); a host that forces one creates a redirect on every page.
- Serve `404.html` **with HTTP status 404** for any path with no file. Do
  NOT use a single-page-app "rewrite everything to `index.html`" rule: it
  would answer unknown and draft URLs with `200` and the homepage.

**Redirects.** Configure every entry of `build-meta/redirects.json` as a
permanent (301) redirect at the host or CDN. Each target is final — no
chains. Targets with a `#fragment` (`/about#values`) keep it. The HTML
forwarding pages in `dist/` are a fallback for a host without redirect
rules; real 301s are what search engines should see. Test every redirect
after deployment.

**HTTPS** on the custom domain, with HTTP → HTTPS redirected.

**Security headers.** Send every header in `build-meta/security-headers.json`
as an HTTP response header: the `"/*"` set on every response, the
`"/assets/*"` set added for assets, and `productionHttpsOnly`
(`Strict-Transport-Security`) on the production HTTPS domain only, once
HTTPS is confirmed domain-wide. The file is regenerated on every build —
the CSP hashes change when page markup changes, so configure the host from
the build output, not from a copy. Pages already carry the CSP as a
`<meta>` tag, so it is enforced even before the host is configured; the
headers add `frame-ancestors`, `X-Frame-Options` and the rest. Details and
reasoning: `docs/SECURITY.md`.

**Compression.** gzip or Brotli for HTML, CSS, JS, SVG, XML, JSON, TXT.
(Measured: the main JS bundle is 344.5 KB raw / 100.5 KB gzip.)

**Caching.**

| Path | Cache-Control |
| --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` — file names change whenever content does |
| everything else (HTML, `robots.txt`, `sitemap.xml`) | `no-cache` (revalidate) — so a redeploy is visible at once |

Redeploying replaces the HTML, which points at the new hashed assets; no
cache purge is needed for `/assets/*`. If a CDN caches HTML, purge it on
each deploy. Never cache form-submission endpoints (Document 12) or any
personalised response as public content.

**Form endpoint (Document 21).** The static site needs ONE server-side
function: `POST /api/forms` on the same origin, running
`server/handler.mjs` with the server-only variables in
`server/env.example` (`EMAIL_API_KEY` is a secret). Rate limiting must be
backed by the platform or a shared store on serverless. Until it is
configured and activated (checklist in `docs/FORMS_AND_EMAIL.md`) the
forms stay disabled and the site needs no function at all.

**Donation endpoints (Document 22).** When donations launch, the same
function (or a second one) serves `/api/donations/*` — `config`, `order`,
`verify`, `webhook`, `status/:reference` — running
`server/donations/handler.mjs` with the Razorpay variables in
`server/env.example`. The webhook path must accept POSTs from Razorpay's
servers (no browser Origin). Never cache any `/api/` response. Until then
donations stay off and nothing is needed (`docs/DONATIONS.md`).

**Server functions & rate limiting (Document 25).** `/api/forms` and
`/api/donations/*` run the Fetch-API handlers in `server/`, both behind
one host-neutral entry point, `createServerApp` in `server/app.mjs`
(Document 26). The host's adapter builds it once per instance and passes
each `/api/` request plus the client IP (docs/HOST_CONFIGURATION.md). **Rate limiting must suit the host:**
- serverless or more than one instance → the adapter passes a shared
  limiter (the platform's rate limiting or a shared store, interface
  `hit(key) → { allowed }`) and sets `RATE_LIMIT_STORE=shared`;
- one long-lived process → `RATE_LIMIT_SINGLE_INSTANCE=true` confirms the
  in-memory limiter is honest.
In LIVE mode neither → the endpoint **stays off** and logs a
`config-problem` line (fail closed; tested in `server/test/rate-limit.test.mjs`).

**Release artifact.** `npm run release:package` writes
`release-artifacts/rbb-<contentRevision>-<commit>.tar.gz`: `dist/` plus
`deploy/` (redirects, security headers, routes, build revision and a
sha256 manifest of every file with one `digest`). Deploy exactly that
artifact; keep the current and previous known-good ones for rollback. The
build is deterministic — rebuilding the same commit gives the same digest
(verified 2026-09-24). The manifest records how many working placeholders
the build still carries (`contentPlaceholders`).

**Error pages.** Production React shows no stack traces; a page that fails
while running shows the site's own "Something went wrong" message
(`components/ErrorBoundary`) and reports nothing anywhere.

**Preview deployments (Documents 26, 27).** There is one build. Deploy the
same artifact to a preview address to review the site before launch,
ideally behind access control, with the form function in `EMAIL_MODE=test`
or `staging` and Razorpay in TEST mode only. Keeping a preview out of the
index is the HOST's job — `X-Robots-Tag: noindex` on the preview
hostname — not the content's; check it with
`npm run smoke -- --url=<preview> --expect=preview --origin=<production>`.
Whether a build carries RBB's final content is reported by
`npm run release:status` (`build-meta/content-readiness.json`).

## Environment

Only `VITE_*` variables reach the browser — **never put a secret in one**.

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | The production origin, e.g. `https://www.<domain>`. **Leave empty until RBB confirms the domain.** Only an https origin on a real host is accepted (`src/config/env.js`); `localhost`, `example.com` and other reserved names are ignored. Empty → no canonical tags, no `og:url`, no sitemap, no structured data URLs. Set it, rebuild, and all of them appear. |
| `VITE_ENVIRONMENT` | `dev`, `preview` or `prod`. Optional measurement (none approved — Document 17) can only run in a production build with `prod` AND a verified `VITE_SITE_URL`; set `preview` on preview deployments. |
| `VITE_FORM_ENDPOINT_*` | Public form endpoints (Document 12). Empty → forms stay disabled. |
| `VITE_DONATIONS_API` | Public donation endpoints, `/api/donations` (Document 22). Empty → no donation network code in the build (the form shows only as the no-payment preview while donations are pending). Razorpay keys and secrets are server variables, never `VITE_*`. |
| `VITE_DESIGN_SYSTEM_ROUTE`, `VITE_COMPONENTS_ROUTE` | Dev tools; off in production unless set. |

Files: `.env.development` (dev server), `.env.production` (production
build), `.env.local` (untracked, per machine). A **preview** deployment
should build with `VITE_SITE_URL` empty, so previews never claim to be the
canonical site.

## Content freshness

Pages are rendered at build time from the files in `src/content/`. A
content change goes live with the next build and deploy. Only add
**approved** records to those files: every record in them ships in the
JavaScript bundle, even one the site never shows.

## Before launch — checklist

- [ ] Host serves `dist/` with the routing rules above; `404.html` returns 404.
- [ ] All redirects in `build-meta/redirects.json` are 301s; each tested.
- [ ] HTTPS and the custom domain work; HTTP redirects to HTTPS.
- [ ] Compression and cache headers as above.
- [ ] `VITE_SITE_URL` set to the confirmed domain; site rebuilt; `sitemap.xml` present.
- [ ] Host's own cookies and scripts checked and recorded in `TECHNOLOGY_AUDIT` (`src/content/policies.js`).
- [ ] Core Web Vitals re-measured on the live site (targets below).
- [ ] `scripts/audit-technology.mjs` run against the live site; `docs/TECHNOLOGY_AUDIT.md` updated.
- [ ] `build-meta/observability.json` shows nothing enabled that RBB has not approved.
- [ ] Security headers from `build-meta/security-headers.json` served; HSTS after HTTPS is confirmed (`docs/SECURITY.md`).
- [ ] If forms launch: the `/api/forms` function and its server environment, per `docs/FORMS_AND_EMAIL.md`.
- [ ] If donations launch: the `/api/donations/*` function, Razorpay webhook and activation checklist in `docs/DONATIONS.md`.
- [ ] Rate limiting suits the host (shared limiter, or a confirmed single instance) — see Server functions above.
- [ ] `npm run smoke -- --url=https://<domain>` passes, with `--browser` (docs/LAUNCH_RUNBOOK.md).

## Performance targets

Engineering targets, not claims: **LCP ≤ 2.5 s**, **INP ≤ 200 ms**,
**CLS ≤ 0.1** on representative mobile conditions. Measure the production
build or the live site — never the dev server.

## Fonts

DM Sans (brand) loads from Google Fonts — one third-party request on every
page (see `TECHNOLOGY_AUDIT`). It replaced Satoshi, and with it the second
font provider: Fontshare is no longer contacted at all.

- One stylesheet, render-blocking, `font-display: swap`.
- The roman axis across 300–900, as a variable font: one file per subset
  covering every weight the site uses. No italic — no page sets it.
- Dancing Script is not requested — no page uses it.

Self-hosting would remove the last cross-origin stylesheet and font
request. DM Sans is under the SIL Open Font License, which permits it, so
this is now a decision about build tooling rather than one waiting on a
licence. Typography is unchanged either way.

## Images

Public-page photographs are served as responsive WebP copies (480–1600 px)
via `components/Picture`, with the original JPEG as the fallback and
`width`/`height` set. The copies live in `src/assets/responsive/` and are
committed; regenerate them with `scripts/responsive-images.mjs` (see its
header) when a photograph is added or replaced. Approved imagery only.
