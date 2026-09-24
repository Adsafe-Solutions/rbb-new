# Host configuration — Document 26

How the release process (Document 25) connects to a real host. **As of
2026-09-24, no host, domain, DNS provider or TLS provider has been
selected**, so nothing here is host-specific. This document is the contract
any host must meet. `docs/DEPLOYMENT.md` → Ownership records the decisions
once RBB makes them.

**Not production-ready.** A real preview deployment and a real production
smoke test have not happened, because there is no host yet.

## What cannot be configured until RBB decides

| Blocked item | Needs |
| --- | --- |
| Host adapter (the function entry point for `/api/*`) | Hosting platform + runtime model |
| DNS records (A / AAAA / CNAME) | Domain, DNS owner **and** the records the selected host supplies — never invented |
| TLS certificate, HTTP → HTTPS, HSTS | Host (usually automatic) + domain |
| `VITE_SITE_URL` | The approved domain, and whether `www.` or apex is canonical |
| Host header / redirect / 404 rules | Host's configuration format |
| Rate limiting for live forms/donations | Runtime model: shared limiter vs. single instance |
| Preview deployments and their noindex | Host's preview model |
| Real-host security and technology audit | A deployed preview |
| Resend live delivery | New key (the planning key **must be revoked**), verified sending domain, From, recipients |
| Razorpay live | RBB account, credentials, webhook URL on the real domain |
| Monitoring / incident response | Approved provider (if any), incident contact |

## The contract a host must meet (§4–§8)

The release artifact (`npm run release:package`) contains `dist/` and
`deploy/`. The host is configured from `deploy/`. The rules are the same
for any platform:

| Requirement | Configure from | Rule |
| --- | --- | --- |
| Static pages | `dist/` | Serve `/<route>` from `dist/<route>/index.html` **without** adding a trailing slash. No single-page-app "rewrite everything to index.html" rule |
| True 404 | `dist/404.html` | Any path with no file → `404.html` **with status 404** |
| Permanent redirects | `deploy/redirects.json` | Every entry as a 301 (or 308) at the host. Query string preserved; the `#fragment` targets stay as given |
| Canonical host | Ownership table | The non-canonical host (`www.` or apex) permanently redirects to the canonical one |
| HTTPS | Host | HTTPS only; http → https permanent redirect |
| Security headers | `deploy/security-headers.json` → `"/*"` | Every header, on every HTML response |
| HSTS | `…"productionHttpsOnly"` | **Only** on the production domain, **after** HTTPS is confirmed stable. No `includeSubDomains` or `preload` without an explicit infrastructure decision |
| Caching | `…"/*"`, `…"/assets/*"` | HTML `no-cache`, so a release is never served stale. `/assets/*` `public, max-age=31536000, immutable`. After a deploy, the CDN either revalidates HTML or purges it |
| API routes | `server/app.mjs` | `/api/forms` and `/api/donations/*` → the adapter. Never cached (the handlers send `no-store`; the CDN must not override it) |
| Preview deployments | Host feature | Non-indexable: `X-Robots-Tag: noindex, nofollow` on every preview response. The artifact is the production one, so its canonicals point at the production domain |
| Secrets | Host secret store | Server-side only. Names: `server/env.example`. Never `VITE_*`, never copied from staging files |

**Production environment at first deploy** (names only):

- Build-time: `VITE_SITE_URL=https://<domain>`, `VITE_ENVIRONMENT=prod`.
- `VITE_FORM_ENDPOINT_*` and `VITE_DONATIONS_API` stay **unset** until
  forms or donations are approved.
- Server: `EMAIL_MODE=off` and `DONATION_ENABLED=false` until their
  checklists are complete. No measurement stream is enabled (Document 17).

## The smallest possible adapter (§4 of the prompt)

Once the host is known, the adapter is only this, and nothing
host-specific enters the application:

1. Build the app **once per runtime instance**:
   `createServerApp({ env, rateLimiter })` from `server/app.mjs`. Log
   `app.problems` (names only) at startup.
2. For each request under `/api/`, call
   `app.handle(request, { clientIp })`. `clientIp` comes from the host's
   trusted client-address field, never from a header a visitor can set.
3. Pass everything else to the host's static file serving.
4. Match the rate limiting to the runtime (Document 25):

   | Runtime | Configuration |
   | --- | --- |
   | Serverless / edge / autoscaling containers | `RATE_LIMIT_STORE=shared` + the platform's rate limiting or a shared store as `rateLimiter` (and `statusLimiter`) |
   | One long-running process (verified, never assumed) | `RATE_LIMIT_SINGLE_INSTANCE=true` |
   | Anything else in live mode | The endpoints stay **off** (fail closed) |

`server/dev-server.mjs` is the reference implementation for a single
long-running process. It is local only, and it already behaves as the
host must: real 301s, a real 404, headers from the manifest, and
`PREVIEW_NOINDEX=true` for a preview.

## Preview → cutover → rollback (§14–16)

1. **Preview.** Deploy the exact release artifact to a preview URL, then run:
   - `npm run smoke -- --url=<preview> --expect=preview --origin=https://<domain>`
     (checks the X-Robots-Tag noindex header and that canonicals point at
     production)
   - the same command with `--browser`, via `npx -p playwright node scripts/smoke-test.mjs`
   - `node scripts/audit-technology.mjs <preview>` for cookies, storage,
     injected scripts and third parties

   Fix host problems here, before DNS changes. Never weaken the CSP to
   silence a host-injected script; identify the exact request first.
2. **Cutover.**
   - Confirm the artifact digest.
   - Set the production secrets and variables.
   - Deploy the verified artifact and check it on the host's own URL.
   - Point DNS using only the records the host supplies.
   - Once HTTPS is confirmed stable, turn on HSTS.
   - Run `npm run smoke -- --url=https://<domain>` plus `--browser`.
   - Confirm forms and donations are still off unless approved.
   - Record the digest, content revision, commit and time
     (`EVIDENCE.productionSmoke`).
3. **Rollback.** Redeploy the previous artifact. Never edit production
   files by hand. Then smoke-test again, re-check DNS, TLS and headers,
   and record the reason and the digests. The full procedure is in
   `docs/LAUNCH_RUNBOOK.md`.

## Host acceptance checklist (§17)

"Local" means proven on the reference server on 2026-09-24. "Real host"
means pending.

| Check | How | Local | Real host |
| --- | --- | --- | --- |
| HTTPS | smoke (https URL) | n/a | pending |
| HTTP → HTTPS | smoke | n/a | pending |
| Permanent redirects | smoke | ✓ 12/12 | pending |
| True 404 | smoke | ✓ | pending |
| Security headers | smoke | ✓ | pending |
| CSP (enforced; no wildcard or `unsafe-eval`) | smoke + `--browser` | ✓ 0 violations | pending |
| Canonical URLs | smoke | ✓ (preview simulation: 15/15 point at production) | pending |
| robots.txt | smoke | ✓ | pending |
| sitemap.xml | smoke | ✓ (with a test origin: 15 URLs) | pending |
| Images and assets | smoke | ✓ all load | pending |
| Serves this release (same bundle hash) | smoke | ✓ | pending |
| HTML revalidated; API `no-store` | smoke | ✓ | pending |
| Hydration and browser behaviour | `--browser` | ✓ | pending |
| Cookies and storage | `--browser` + technology audit | ✓ none | pending |
| Third-party requests (fonts only) | `--browser` + technology audit | ✓ | pending |
| No mixed content | `--browser` on https | n/a | pending |
| Working-placeholder scan | smoke (`--expect=production`) + `npm run release:status` | ✓ none | pending |
| Release digest recorded | `npm run release:package` | ✓ deterministic | pending |
| Rate limiting matches the runtime | adapter configuration | ✓ fails closed | pending |

## Infrastructure approval matrix (§20)

| Decision | Owner | Status |
| --- | --- | --- |
| Production domain | RBB | Pending |
| Hosting provider | RBB | Pending |
| DNS access and ownership | RBB | Pending |
| TLS / HTTPS | RBB + host | Pending |
| Deployment access | RBB + engineering | Pending |
| Incident contact | RBB | Pending |
| Resend production | RBB | Pending |
| Razorpay production | RBB | Pending |
| Analytics / monitoring | RBB | Pending |
