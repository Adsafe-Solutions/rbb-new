# Release readiness — Document 24

This is how a production release is assessed, and where it stands.

## Current state (2026-09-24): **PREVIEW-READY** — not releasable

There is one content source and one build (Document 27): `npm run dev`
and `npm run build` show the same complete website, and it is verified —
build, hydration, CSP, accessibility, responsive, forms in test mode,
donation states.

Most of that content is a self-labelled WORKING PLACEHOLDER
(`docs/WORKING_CONTENT.md`), because no RBB-approved replacement content,
credentials or provider configuration has been supplied. Nothing has been
invented to fill the gaps: figures, financial percentages and documents
still show their honest pending state. The release state stays below
PRODUCTION-CONTENT-READY until RBB's own content replaces the
placeholders — which the build counts for you.

```sh
npm run build            # the site, and the readiness scan of its output
npm run release:status   # state + every blocker → build-meta/release-status.json
npm run release:check    # THE go / no-go: READY or BLOCKED → build-meta/release-check.json
```

## The final gate: `npm run release:check`

One command answers "is THIS build, with THIS production environment, safe
to deploy publicly?" It builds and prerenders, runs content validation and
the release and server tests, then checks the artifact and prints
**READY** or **BLOCKED**, with every blocker as what / why / what is
needed. Blockers are grouped by category: APPROVAL, CONTENT, SEO, ROUTES,
LEGAL, CONTACT, IMAGES, FORMS, EMAIL, DONATIONS, SECURITY, INFRASTRUCTURE,
ACCESSIBILITY, PERFORMANCE. It exits 0 only when READY.

```sh
# Run in the environment the release is built in (VITE_SITE_URL etc.):
npm run release:check -- --env-file=<production server env>   # values never printed
npm run release:check -- --url=https://<preview or production> # + browser smoke
```

- **Sources it reads and never changes:** `release/approvals.mjs` (APPROVALS
  and EVIDENCE), the build's own records in `build-meta/`, the placeholder
  markers (`src/lib/releaseMarkers.js`), the safety and indexing gates
  (`scripts/production-gate.mjs`), and the server's own config loaders.
- **Fails closed:** anything it cannot confirm is a blocker. That includes a
  build from uncommitted source, a deployment that has not been
  smoke-tested, and release evidence not yet recorded.
- **Online donations:** if `donation` is approved and the page is not live,
  that is reported as *donations disabled by approved launch decision*. If
  the page is live, Razorpay must be live and verified. Forms work the same
  way with `forms`.
- **`release:status`** remains the progress view (which state the project
  has reached). It shares one calculation with this gate
  (`scripts/lib/release-state.mjs`).
- **Tests:** `scripts/test/release-check.test.mjs` proves the gate can say
  READY when everything is final, and that each kind of break says BLOCKED.

**Expected today: BLOCKED.** RBB's content, approvals, domain and production
configuration do not exist yet. That is the correct answer.

## Release states (§22)

| State | Means | Needs |
| --- | --- | --- |
| CONTENT-INCOMPLETE | The complete site is not yet verified | — |
| **PREVIEW-READY** | The complete site works and can be reviewed; it still carries working placeholders | `EVIDENCE.previewQa` passed |
| PRODUCTION-CONTENT-READY | All content areas approved, the content agrees, **and no working placeholder is left** | Approvals: core identity, impact, financials, programs, team, geography, stories, contact, policies, images — each checked against what the build actually contains (`build-meta/readiness.json`), plus 0 findings in `build-meta/content-readiness.json` |
| PRODUCTION-INTEGRATION-READY | Providers configured and tested for real | Approvals for forms, email, donation and infrastructure. Real Resend staging delivery, real Razorpay TEST flows and webhooks, Checkout CSP re-verified, live credentials in the host's secrets, host headers verified |
| RELEASE-READY | Frozen and fully tested | Final QA matrix passed on the frozen candidate; `contentFreeze` recorded with the build's `contentRevision` |

**Technical tests never move the state past a missing approval.** An
approval recorded while the content disagrees is itself a blocker. For
example, impact marked "approved" while `content/impact.js` still says
pending-review blocks the next state. Approvals and test evidence are
recorded in `release/approvals.mjs`: who, date and reference, never a
secret.

## Two scans, two jobs (§18–19, as Document 27 redraws them)

**Safety — fails every `npm run build`.** A defect at any stage, in any
environment (`scripts/production-gate.mjs`, run by
`scripts/prerender.mjs`, scanning every HTML/JS/CSS/XML/text file and
every file name in `dist/`):

- Razorpay key ids (test or live — they come from the server at run time)
- Resend or other API keys, secret variable names, private keys
- email previews, `.env` files, source maps, server code
- development-catalogue content, test fixtures and dev routes
  (`/design-system`, `/components`)

The same credential rules run over the content files themselves
(`src/content/validate.js`), together with every Document 18 rule.

**Readiness — never fails a build.** Working placeholder content is
normal and must be publishable: that is how the whole site can be built,
deployed to a preview and reviewed. The same scan records where it is
(`build-meta/content-readiness.json`) and `npm run release:status` holds
PRODUCTION-CONTENT-READY until it is empty:

- placeholder wording (`Demo text —`, `Demo —`, `WORKING text —`, …)
- the fictional team names and `· Demo profile` roles
- demo countries, locations, figures, quotations, documents and roles
- `example.org/com/net` addresses (the format hint `name@example.com` is
  exempt) and 555 phone numbers
- `demo-*` photographs and the placeholder team profile routes

`npm run smoke -- --expect=production` applies the same two rules to a
deployed site: credentials always fail; placeholders fail only a
production run.

Tested: 6 fixture tests (`npm run test:release`), including that ordinary
placeholder content does NOT fail the safety gate. The current build
passes the safety gate with 0 and reports its placeholders honestly.

## Content freeze (§23)

Each build writes `build-meta/build-revision.json`:

- `contentRevision` — a hash of every file under `src/content` and
  `src/assets`, never their text
- the git commit
- whether `src/` has uncommitted changes

Once RBB approves a release candidate, record its `contentRevision` in
`EVIDENCE.contentFreeze` (`status: "frozen"`). Any later build with a
different revision is reported as "content changed after the freeze", and
needs validation and QA again.

## Final QA matrix (§21) — last run 2026-09-24 on the production candidate

| Check | Result |
| --- | --- |
| Production build + release gate | ✓ 28 routes, 404, 12 redirects; gate clean |
| Content validation (`npm run validate:content`) | ✓ No problems |
| Server tests (`npm run test:server`) | ✓ 60/60 |
| Release gate tests (`npm run test:release`) | ✓ 5/5 |
| Route crawl + hydration | ✓ 28 routes, 0 tag problems, 12 redirects followed |
| Console scan | ✓ Clean (one intentional 404 probe) |
| CSP, 1280 + 375 px | ✓ 0 violations |
| Security headers (local host sim.) | ✓ CSP, nosniff, Referrer-Policy, Permissions-Policy, XFO, COOP, CORP, caching |
| Secret scan (repo + dist) | ✓ Clean |
| `npm audit` | ✓ 0 vulnerabilities |
| axe (WCAG 2.2 AA rules), all 28 routes + 404 | ✓ 0 violations |
| Keyboard: skip link first; visible focus on every stop | ✓ After fix (below): 413 stops, all ≥ 3:1 |
| 320 / 375 / 640 px, reduced motion, all routes | ✓ No overflow |
| Broken links / images / in-page anchors (41 pages) | ✓ None |
| Sitemap / robots / canonical — tested with a hypothetical origin | ✓ After fix (below): 15 indexable pages in the sitemap, each with its own canonical; 13 noindex pages without one |
| Performance, slow 4G + 4× CPU | ✓ LCP 1.5–2.1 s, CLS 0; JS 104 KB gzip, CSS 14 KB gzip |
| Forms E2E | ✓ Staging, email test mode (Document 23): 15/15. **Real Resend delivery: not run** |
| Donations E2E | ✓ Stand-in Razorpay: 30/30. **Real Razorpay test flow: not run** |
| Webhook verification / idempotency | ✓ Unit-tested (60 server tests). **Real webhooks: not run** |

**Fixed in this phase:**

1. **Focus rings on Deep Trust Blue.** Heroes, the impact band, the
   donation panel and the footer measured 1.15:1 against the blue. They
   now use a white ring (9.9:1), and white cards on blue keep the ink ring.
2. **A launch blocker in the build.** Setting `VITE_SITE_URL` made the
   production build fail, because the site's own canonical and `og:url`
   were counted as an unapproved third-party origin. The site's verified
   origin is now first-party.

## Exact blockers to RELEASE-READY

Run `npm run release:status` for the live list. As of this phase:

1. **RBB approvals — all 14 areas pending.** Core identity, impact
   figures (50K+ / 25 / 200+), financial shares (78 / 12 / 10) and
   documents, programs, team, geography, stories, contact, forms,
   donation, email, policies, image licences, infrastructure.
2. **Content not yet supplied:**
   - verified impact figures and financial overview
   - annual reports
   - program detail
   - projects, team and geography
   - stories
   - contact details
   - Privacy and Terms text
3. **Integrations:**
   - Resend: a new key is needed (the planning key is compromised and must
     be revoked), plus a verified sending domain and approved From address
     and recipients; then a real staging delivery.
   - Razorpay: test credentials, then real test payments and webhooks, the
     Checkout CSP re-verified, then live credentials.
4. **Infrastructure:** the production domain (`VITE_SITE_URL`), a host,
   HTTPS, redirects and headers served by the host, a host audit, and log
   retention.
5. **Images:** `ngo-classroom.jpg` has no known source; RBB must confirm
   its field images and approve or replace the inherited Pexels photos
   (`docs/IMAGE_INVENTORY.md`).
6. **Final QA and content freeze** on the approved candidate.

## Deployment and launch (Document 25)

Launch sequence, smoke test, rollback and monitoring:
`docs/LAUNCH_RUNBOOK.md`. Host contract, preview and cutover, and the host
acceptance checklist: `docs/HOST_CONFIGURATION.md` (Document 26). Environments and host requirements:
`docs/DEPLOYMENT.md`. Tools:

- `npm run smoke -- --url=…` for the deployed site
- `npm run release:package` for the deployable, identifiable artifact

## Post-launch (§24)

Keep the Document 18 content workflow: edit `src/content/`, run `npm run
validate:content`, run `npm run build`, run `npm run release:status`, then
deploy. No CMS, admin or database was added.
