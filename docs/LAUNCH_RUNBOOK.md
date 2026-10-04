# Launch runbook — Document 25

How the Rising Beyond Borders site goes live, how it is checked, how a
release is rolled back, and what is watched afterwards.

**Status on 2026-09-24: NOT launchable.** `npm run release:status` reports
STAGING-READY. RBB approvals, content, domain, host and provider
credentials are all outstanding (docs/RELEASE_READINESS.md). Every tool
below is built and tested against a local copy. None has run against a
real host, because none exists yet.

**Technical readiness is not RBB approval.** A feature can be built and
tested while it stays off in production. Forms and donations switch on
only through approved content (`src/content/`) **and** server
configuration. Each fails closed when either is missing.

## Do not launch until

- [ ] The production domain and host are selected and recorded (docs/DEPLOYMENT.md → Ownership).
- [ ] HTTPS, HTTP → HTTPS, host security headers, permanent redirects and a true 404 are verified with `npm run smoke`.
- [ ] Required RBB content and the Privacy and Terms policies are approved and published.
- [ ] Image ownership and licensing are resolved (docs/IMAGE_INVENTORY.md).
- [ ] Resend: the planning key has been **revoked**; a new key is stored only in the host's secrets; the sending domain, From address and recipients are verified; a staging delivery has been received.
- [ ] Razorpay (only if donations launch): test flows and webhooks pass, the Checkout CSP has been re-verified, and live keys are in the host's secrets only.
- [ ] Rate limiting suits the host (shared limiter, or a confirmed single instance).
- [ ] `npm run release:check` reports **READY** for the release candidate (it builds, tests and checks the artifact, the production environment and the approvals).
- [ ] The production smoke test passes.

## Launch-day sequence (§15)

| # | Step | Command / check | Record |
| --- | --- | --- | --- |
| 1 | Every Document 24 blocker is resolved, or explicitly accepted by RBB in `release/approvals.mjs` | `npm run release:status` | state |
| 2 | Freeze content: set `EVIDENCE.contentFreeze` to `frozen` with the candidate's `contentRevision` | `build-meta/build-revision.json` | revision |
| 3 | Domain, DNS and HTTPS live on the host | host dashboard | — |
| 4 | Host headers (`deploy/security-headers.json`) and 301s (`deploy/redirects.json`) configured; unknown paths → `404.html` with status 404; no SPA catch-all | — | — |
| 5 | Production secrets and variables set in the host's secret store — never in the repo or in `VITE_*` | `server/env.example` for names | — |
| 6 | Resend domain, sender and recipients verified | Resend dashboard; staging delivery received | — |
| 7 | Razorpay configured, if donations launch | docs/DONATIONS.md checklist | — |
| 8 | Build the release candidate with `VITE_SITE_URL=https://<domain>` and run the final gate | `npm ci && npm run release:check -- --env-file=<production server env>` | **READY** |
| 9 | Package and deploy **that** artifact | `npm run release:package` → upload `dist/` | artifact digest |
| 10 | Production smoke test | `npm run smoke -- --url=https://<domain>` then again with `--browser` (via `npx -p playwright`) | pass |
| 11 | Robots, sitemap and canonicals point at the domain | covered by the smoke test | — |
| 12 | Forms and payments behave as their activation state says: disabled forms show no form; enabled ones deliver; donations are closed, or a live test payment is refunded per RBB's procedure | manual + smoke output | — |
| 13 | Record the release | artifact digest, content revision, commit, time, who deployed | release log |
| 14 | Start the agreed monitoring window | see Monitoring | — |

Host setup, preview and cutover details: `docs/HOST_CONFIGURATION.md`.

## Smoke test (§12) — `npm run smoke`

Plain HTTP; no dependencies. Run it from the same checkout that built the
deployed artifact.

- all 28 routes return 200 HTML with an `<h1>`
- an unknown path returns a real 404
- every redirect is a 301 or 308 to the right target
- security headers are sent as HTTP headers; HSTS is present on https;
  http redirects to https
- robots.txt, sitemap and canonicals match the mode and the domain
- every referenced image and asset loads
- no demo content, placeholder contact or credential appears
- the form and donation endpoints answer according to their state, and a
  test-mode payment endpoint on production fails the check

`--browser` adds, at 1280 and 375 px, across every route:

- console errors and CSP violations
- cookies and web storage
- unapproved third-party requests
- the skip link as the first Tab stop
- the mobile menu

`--expect=preview` checks a preview deployment instead (the host must mark
it noindex, and canonicals must point at `--origin`). `--expect=local`
checks a working copy. A credential fails any run; working placeholder
content fails only `--expect=production`.

Proven locally on 2026-09-24:

- The build on the reference server (`npm run serve:local`) passes 16/16
  HTTP checks, and 27/27 with `--browser` (2026-09-24, Document 27).
- The same build with `--expect=production` **fails** on its working
  placeholder content, as it should until RBB's own content is in.

## Rollback (§13)

A release is identified by its artifact digest and content revision. Keep
the current and previous known-good artifacts.

1. **Decide.** A critical defect is one of: a broken page or payment, data
   going to the wrong place, a security header or CSP failure, or demo
   content that is live.
2. **A form or donation misbehaving:** switch it off server-side first. It
   takes effect without a redeploy:
   - forms: `EMAIL_MODE=off`, or remove that form's `EMAIL_TO_*`
   - donations: `DONATION_ENABLED=false`

   The browser then shows the honest unavailable state.
3. **The site itself:** redeploy the previous known-good artifact's
   `dist/` exactly as packaged. No content is edited by hand.
4. **Re-check:** run `npm run smoke -- --url=https://<domain>` from the
   checkout of that artifact. Also check DNS, redirects, headers and CSP,
   and that the environment variables match that release.
5. **Record:** the reason, the affected artifact digest, and the digest
   restored.

## Post-launch monitoring (§14)

No monitoring provider is approved or enabled (Document 17). Until one is:

- **HTTP errors and 404/redirect spikes:** the host's own logs and
  analytics dashboard, if it has one. Those count as a third party to
  audit and to cover in the Privacy Policy.
- **Form delivery:** the handler's JSON log lines (`outcome`:
  `provider-rejected`, `provider-unavailable`, `rate-limited`,
  `config-problem`) plus the Resend dashboard.
- **Payments:** the donation handler's log lines (`verify-*`, `webhook-*`,
  `state`) plus the Razorpay dashboard's payments and webhook deliveries.
- **CSP:** violations show in the browser console. A reporting endpoint
  needs an approved collector.
- **Performance:** re-measure the Core Web Vitals targets in
  docs/DEPLOYMENT.md on the live site.
- **Third parties:** re-run `scripts/audit-technology.mjs` against the
  live site after the first deploy and after any host change.
- **Logs:** they never contain names, emails, messages, IP addresses,
  signatures or keys. Keep them that way; decide retention with the host.

## Maintenance boundary (§18)

Content changes go through the content workflow: edit `src/content/`,
then `npm run validate:content`, then `npm run build`, then
`npm run release:status`, then deploy the new artifact. Infrastructure
changes are reviewed separately. No CMS, admin dashboard, database,
analytics, payment provider or widget is added without a new architecture
and approval decision.
