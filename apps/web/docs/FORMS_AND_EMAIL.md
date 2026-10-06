# Forms & email — Rising Beyond Borders website

Document 21. How the Contact, Volunteer, Partner, Fundraise and Newsletter
forms send, and what must happen before they go live. **All forms are
still disabled on the public site** — see *Activation* below.

## Architecture

```
browser (static site)
  └─ POST /api/forms  (same origin, JSON)
       └─ submission handler — server/handler.mjs  (serverless function)
            ├─ method · Origin · Content-Type · size · JSON
            ├─ form available?  (mode, approved recipient)
            ├─ honeypot · fill time          → silently discarded
            ├─ server-side validation        → 422 with field codes
            ├─ rate limit (client + form)    → 429
            └─ Resend REST API (server-to-server, EMAIL_API_KEY)
                 ├─ notification → approved RBB inbox   (Reply-To: submitter)
                 └─ acknowledgement → submitter         (only where enabled)
```

- The site stays static and pre-rendered. The handler is one function: it
  takes a standard Fetch API `Request` and returns a `Response`, which the
  serverless runtimes of the common static hosts accept directly or with a
  few lines of adapter. No host is chosen, so no adapter is written; the
  host's function simply imports `createSubmissionHandler` and
  `loadConfig` and passes the client IP it knows.
- The browser never talks to Resend. The key never reaches the browser:
  it is not a `VITE_*` variable, not under `src/`, not in `dist/`
  (verified by scan).
- **No database.** Submissions are forwarded by email only; nothing is
  stored. Persistent storage would be a separate approved decision
  (retention, access, backups, privacy).

## Files

| Path | What |
| --- | --- |
| `src/lib/formSchema.js` | The ONE field schema — shared by browser and server |
| `server/handler.mjs` | The endpoint (platform-neutral) |
| `server/config.mjs` | Server-side configuration from the environment |
| `server/validate.mjs` | Server-side validation and normalisation |
| `server/rate-limit.mjs` | Rate-limit boundary (in-memory default) |
| `server/email/resend.mjs` | Resend REST call — the ONE Resend client (donations reuse it) |
| `server/email/deliver.mjs` | The `EMAIL_MODE` rules (test/staging/live), shared with donations |
| `server/http.mjs` | JSON responses, bounded body reading, references |
| `server/email/templates.mjs` | The email templates |
| `server/dev-server.mjs` | **Local testing only** — serves `dist/` + `/api/forms` |
| `server/test/*.test.mjs` | Test matrix — `npm run test:server` |
| `server/env.example` | Server variable names (no values) |

## Configuration (server environment only)

Names only — values live in the host's secret settings.

| Variable | Purpose |
| --- | --- |
| `EMAIL_API_KEY` | **Secret.** Resend API key (`RESEND_API_KEY` accepted as an alias). Use a sending-access key restricted to the verified domain. **The key shared during planning is compromised — revoke it and create a new one.** |
| `EMAIL_MODE` | `off` (default) · `test` (render, send nothing) · `staging` (send everything to `EMAIL_TEST_RECIPIENT`, subjects `[TEST]`) · `live` |
| `EMAIL_FROM` | Approved sender on the verified domain. `@resend.dev` is refused in `live` |
| `EMAIL_TO_CONTACT` … `_VOLUNTEER` `_PARTNER` `_FUNDRAISE` `_NEWSLETTER` | Approved RBB recipient per form. A form with none is unavailable |
| `EMAIL_ACK_FORMS` | Forms that email the submitter an acknowledgement (default none) |
| `NEWSLETTER_ENABLED` | `true` only when consent, unsubscribe and subscriber management exist |
| `EMAIL_TEST_RECIPIENT` | Staging inbox |
| `ALLOWED_ORIGIN` | The site's origin; other `Origin`s are refused |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_S` | Per client + form (default 5 per 600 s) |

A misconfigured deployment (live without a key, a temporary sender, a
recipient that is not a single address) **fails closed**: the endpoint
behaves as `off`.

Browser side, `VITE_FORM_ENDPOINT_<FORM>=/api/forms` points a form at the
endpoint — public, not a secret. The build refuses a cross-origin endpoint
unless its origin is approved (`scripts/security-policy.mjs`).

## Validation & safety (server)

- `POST` only; `Content-Type: application/json`; body ≤ 16 KB; JSON parsed
  safely; `Origin` must match `ALLOWED_ORIGIN`.
- Only the form's own fields (`src/lib/formSchema.js`) — any unknown field
  or body key is **rejected** (400), not stripped.
- Trimmed, line endings normalised, control and bidi characters removed;
  lengths and allowed values enforced; email checked, and addresses that
  could smuggle recipients (commas, semicolons, angle brackets…) refused.
- A line break in a single-line field (name, email, organization, topic) is
  a header-injection attempt → rejected.
- Everything a visitor typed is HTML-escaped in emails; subjects contain
  only the form type and reference.
- Responses are generic JSON (`{ ok, reference }` / `{ ok: false, error,
  fields? }` with codes only), `Cache-Control: no-store`. No submitted
  text, provider response, stack or configuration is ever returned.
- Retries: the browser sends one `Idempotency-Key` per submission; the
  handler returns the original reference for a repeat, and passes derived
  keys to Resend, which de-duplicates for 24 h.

## Anti-spam & rate limiting

- **Honeypot** (an off-screen field hidden from assistive technology) and a
  **minimum fill time** (1.5 s). A hit is answered exactly like a success
  and nothing is sent — a bot learns nothing.
- **Rate limit** per client + form. The limiter keys on a one-way hash of
  the client address; no IP address is stored or logged.
- ⚠ The default limiter is in-memory — right for one process and for tests,
  **not sufficient on serverless**, where instances do not share memory.
  In production, back it with the platform's rate limiting or a shared
  store (same `hit(key)` interface).
- A stronger challenge (CAPTCHA-type) can be added later through
  `src/lib/antiSpam.js` + a server check, with its origins approved in the
  CSP and technology audit. None is selected.

## Logging

One JSON line per submission: `{ at, reference, form, outcome,
providerId }`. Never a name, address, message, IP address, header or key.
Outcomes: `sent`, `acknowledged`, `spam-discarded`, `invalid`,
`rate-limited`, `provider-rejected`, `provider-unavailable`, `ack-…`.
Retention follows the host's log settings — **to be decided and documented
before launch**.

## Templates

Nine, all with a plain-text version, table-based and inline-styled, in the
brand colours; the name in text (no approved public logo URL yet); footer
carries the name only until RBB approves its details.

| Template | To |
| --- | --- |
| Contact / Volunteer / Partner / Fundraise notification | RBB inbox — type, sender details, message, reference and time, **Reply** button |
| Contact / Volunteer / Partner / Fundraise acknowledgement | Submitter — **never quotes what they wrote** (the address is visitor-supplied; echoing text would turn the form into a relay) |
| Newsletter confirmation | Subscriber — confirm button only once a confirmation URL exists |
| Newsletter sign-up notice | RBB (subscriber management pending) |

Acknowledgement and newsletter wording is **proposed**; none promises a
reply or a response time.

## User-facing states

Idle · field errors (browser, then server codes shown as the same
messages) · sending (duplicate submits blocked) · success (RBB's approved
text) · rate-limited ("please wait a few minutes") · failure (RBB's approved
error text) · **no JavaScript**: the form is shown disabled with a note —
it cannot submit, so details never end up in a URL.

## Testing locally

```sh
npm run test:server                      # 29 tests, no network
npm run build                            # with VITE_FORM_ENDPOINT_CONTACT=/api/forms etc.
EMAIL_MODE=test EMAIL_TO_CONTACT=… ALLOWED_ORIGIN=http://localhost:5190 npm run serve:local
```

In `test` mode nothing is sent: each email is logged as one summary line
and its HTML written to `build-meta/email-previews/`.

## Activation — all required before a form goes public

- [ ] **Privacy Policy published** (the forms stay disabled until it is — Document 13).
- [ ] Sending domain verified in Resend (SPF/DKIM records at the DNS host); status recorded here.
- [ ] Approved From address; approved recipient per form.
- [ ] New `EMAIL_API_KEY` created (the planning key revoked), stored only in the host's secrets.
- [ ] Rate limiting backed by the platform or a shared store (`RATE_LIMIT_STORE=shared` + the adapter's limiter), or `RATE_LIMIT_SINGLE_INSTANCE=true` for one long-lived process. **Live mode refuses anything else (Document 25).** Thresholds approved.
- [ ] Delivery tested in `staging` to approved addresses.
- [ ] Per form in `content/forms.js`: `status: "approved"`, RBB's `successMessage` and `errorMessage`; `VITE_FORM_ENDPOINT_<FORM>=/api/forms`.
- [ ] Acknowledgements: decide per form (`EMAIL_ACK_FORMS`) and approve the wording.
- [ ] Newsletter: consent wording, unsubscribe, subscriber management, confirmation flow.
- [ ] Log retention decided; `docs/TECHNOLOGY_AUDIT.md` updated (Resend as processor); technology audit re-run on the live site.

## Privacy dependency

Submitted details travel to Resend (processing the email) and to RBB's
inbox. The published Privacy Policy must cover this (Document 13 outline:
*Sharing and service providers*, *Forms and communications*, *Retention*).
Nothing here promises deletion, retention periods or response times.
