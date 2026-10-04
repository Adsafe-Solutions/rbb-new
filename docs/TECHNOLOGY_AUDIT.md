# Technology audit — Rising Beyond Borders website

Document 17. What the website actually loads, sets and sends — the evidence
a privacy policy, cookie statement or consent decision is later based on.
**This is an internal record, not a public statement.** Nothing here is a
legal conclusion about consent or compliance.

## Current state (local production build — host not yet selected)

Audited with `scripts/audit-technology.mjs` against `npm run build` output
served statically, all 48 pre-rendered routes at the time (28 since Document 19 retired the legacy stubs), clean browser profile.

| Item | Finding |
| --- | --- |
| Cookies | **None** set by the site |
| localStorage / sessionStorage | **None** |
| IndexedDB | **None** |
| Service worker | **None** |
| Script origins | First-party only |
| Analytics / tag manager | **None** — no SDK in the bundle, no requests |
| Advertising / remarketing pixels | **None** |
| Session replay / heatmaps | **None** |
| Error / performance / uptime monitoring | **None** |
| Search Console verification | **None** (domain not confirmed) |
| Embeds (maps, video, social) | **None** |
| Forms | All disabled; when active they send with `credentials: "omit"` |

### Third-party requests

| Origin | What | Owner | Purpose | Essential? | Notes |
| --- | --- | --- | --- | --- | --- |
| `fonts.googleapis.com` | stylesheet | Google | DM Sans, the brand typeface | Brand typography | Every page; render-blocking |
| `fonts.gstatic.com` | font files | Google | DM Sans variable file | Brand typography | Loaded from the stylesheet above |

These two are the only third-party origins the Content Security Policy
allows (`APPROVED_ORIGINS` in `scripts/security-policy.mjs`, Document 20);
the build fails if a page loads from any other.

Fontshare (`api.fontshare.com`, `cdn.fontshare.com`) was the third-party
font provider until Satoshi was replaced by DM Sans. It is no longer
contacted, and no longer approved — a page that reaches for it fails the
build.

Each of the two receives the visitor's IP address and browser details.
Self-hosting DM Sans would remove both; the SIL Open Font License permits
it (Document 15).

### Server-side services (not browser origins)

| Service | Where it runs | Data | Status |
| --- | --- | --- | --- |
| Resend (email delivery) | The `/api/forms` function, server-to-server | Form submissions (name, email, message, organization, topic) — delivered to RBB's inbox; acknowledgements to the submitter where enabled | **Integrated, not active** — forms disabled (Document 21). Adds no browser origin, cookie or script. Must be named in the Privacy Policy as a service provider before activation |

### Not yet assessed

- **Hosting / CDN** — cookies, headers, scripts or analytics the chosen
  host adds. Repeat the audit on the real deployment.

## How to re-run the audit

```sh
npx -p playwright node scripts/audit-technology.mjs https://<deployed-site>
# first time: npx playwright install chromium
```

It crawls every route in `build-meta/routes.json` in a clean profile and
writes `build-meta/technology-audit.json`: cookies (name, domain, expiry,
flags, the response that set them), all three storage types, service
workers, and every request grouped by origin and type.

**Repeat it:** after the host is selected; before any cookie or privacy
policy is published; after analytics, monitoring, forms, a consent tool or
any other third-party integration is added. Update this file each time —
the audit's output alone is not a cookie statement.

## Verifying a build

Every `npm run build` writes `build-meta/observability.json` and prints:

```
measurement: none enabled; third-party origins: …
```

`streams.*.enabledInThisBuild` must be `false` for anything RBB has not
approved. A stream can only ever be enabled in a production build with
`VITE_ENVIRONMENT=prod`, a verified `VITE_SITE_URL`, an approved status and
a named provider (`src/config/observability.js`) — development and preview
builds cannot send data.

## Inventory — fill in when a provider is approved

One row per cookie, storage key, script or service. Nothing optional loads
before its row exists and RBB has approved it.

| Name / origin | Type | Stream | Provider | Purpose | Data sent | Essential / optional | Loads before consent? | Duration / retention | Region | Access | Deletion | Approved by / date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | | |

**Identifiers.** Record every analytics, monitoring or verification ID
here with the environment it belongs to. Production identifiers go in
production configuration only; public identifiers may reach the browser,
secret credentials never do (no secret in any `VITE_*` variable).

**Razorpay (Document 22) — built, not active.** Loads ONLY on
`/get-involved/donate`, ONLY in a build with `VITE_DONATIONS_API` and the
checkout approved, and ONLY when the donor presses "Continue to payment" —
never on page load. The rows below become real once it is activated;
re-run `scripts/audit-technology.mjs` on the live page then.

| Name / origin | Type | Stream | Provider | Purpose | Data sent | Essential / optional | Loads before consent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `checkout.razorpay.com` | script | payment | Razorpay | Checkout | order id, amount, currency, prefill name/email/phone | Essential to donate | On the donor's action only |
| `cdn.razorpay.com` | script | payment | Razorpay | Checkout risk detection | device/browser signals (Razorpay's) | Essential to donate | On the donor's action only |
| `api.razorpay.com` | frame | payment | Razorpay | The payment window; card/bank/UPI entry | payment details (to Razorpay only) | Essential to donate | On the donor's action only |
| `lumberjack.razorpay.com` | connect | payment | Razorpay | Checkout telemetry | Checkout events (Razorpay's) | Set by Checkout | On the donor's action only |
| Resend (server-to-server) | email | email | Resend | Donation emails | donor name/email, amount, reference | Essential once enabled | n/a — never in the browser |

Cookies/storage set by Razorpay inside its own frame are Razorpay's; record
them after the live audit. Duration, region, retention and deletion are
pending RBB's Razorpay account and privacy review.

## Rules that apply to any future stream

- Analytics, errors, performance and uptime are **separate** streams, each
  with its own purpose, retention and access — never one combined
  collection.
- No form contents, message text, names, emails, phone numbers, addresses,
  payment or donation details in analytics or logs. `src/lib/analytics.js`
  sends only allow-listed properties and strips query strings, emails and
  phone numbers; `src/lib/monitoring.js` sends only an error category and
  the route.
- A Donate click is an intent, never a donation; payment truth comes only
  from the payment provider, server-side.
- Uptime checks use a normal public page, never a form endpoint.
- No session replay, heatmaps, advertising or remarketing without explicit
  RBB approval.

## Decisions pending RBB

| Decision | State |
| --- | --- |
| Production domain | Pending |
| Hosting provider | Pending |
| Analytics provider, purposes and events | Pending (events proposed in `src/lib/analytics.js`) |
| Consent approach | Pending legal/privacy review |
| Search Console verification | Pending domain and host |
| Error monitoring | Pending |
| Performance / field monitoring | Pending |
| Uptime monitoring | Pending |
| Form provider | Pending |
| Donation / payment provider | **Razorpay selected** (Document 22); built, OFF — activation pending (`docs/DONATIONS.md`) |
| DM Sans self-hosting | Not done — permitted by the SIL OFL whenever RBB wants the last third-party request gone |
| Accessibility statement | Not published — page removed at RBB's request |
