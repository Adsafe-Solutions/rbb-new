# Donations — Razorpay (Document 22)

How online donations work on the Rising Beyond Borders site, what is built,
and what must happen before they go live. **Donations are OFF.** The page
at `/get-involved/donate` says that online donations are not open yet.

## The preview (while donations are pending)

While `DONATION.status` is `pending`, the donation page draws the donation
form as a **preview** (`checkout.preview` in `src/content/donation.js`).
It sits directly under the page header: the statement is on the left and
the white form card is on the right. On a phone the statement comes first
and the form follows it. The preview shows:

- the frequency choice (Give once; Monthly shown disabled, "Not available
  online");
- six amount tiles and an "other amount" field;
- name, email and phone;
- "Continue to payment".

What the preview does and does not do:

- **It takes no payment and makes no request.** There is no `/config`
  call, no order, and the Razorpay script is never loaded.
- **Submitting** runs the form's own checks, then shows "Preview only — no
  payment was started". It never shows success and never shows a
  reference.
- **Typed details are not kept.** They live in page state only: nothing
  is stored, logged or emailed.
- **The submit button is disabled until the page hydrates.** Without
  JavaScript, a native submit would send the typed details to the page's
  URL.
- **The amounts and currency are placeholders.** The currency is ISO 4217
  `XXX` ("no currency"), shown as ¤. These are not proposals: the real
  values come from the server once donations are live (D26, D27). The
  card's badge reads "Demo preview — …", so the placeholder count
  includes it.
- **`npm run release:check` blocks production** while the preview is on
  the page. It reads both `readiness.donation.preview` and the page's
  `data-donation-preview` marker. To launch, either open donations
  (approved-live) or remove `checkout.preview` to launch without online
  donations (D31).

A build without `VITE_DONATIONS_API` still contains no donation **network**
code. `vite.config.js` replaces `src/lib/donations.js` (the endpoint calls
and the Razorpay loader) with an inert module. It used to replace the whole
`DonationCheckout` component, which is why no build ever showed a donation
form.

## Architecture

```
browser (donation page)                       server (serverless function)
  GET  /api/donations/config  ─────────────▶  approved amounts, currency, public key id
  POST /api/donations/order   ─────────────▶  validate → Razorpay order (amount + currency set HERE)
  Razorpay Checkout (Razorpay's own window; card/bank/UPI details never touch this site)
  POST /api/donations/verify  ─────────────▶  signature check → read order + payment FROM Razorpay → state
  GET  /api/donations/status/:reference ───▶  minimal state (processing → confirmed)
Razorpay ── POST /api/donations/webhook ───▶  signature check (raw body) → state → emails (Resend)
```

- **The server decides.** The browser picks one of the approved amounts
  (or types one within the approved bounds). The server re-validates it,
  sets the currency and creates the order. It never accepts a currency,
  order id or amount-in-minor-units from the browser.
- **The Checkout callback is a claim, not proof.** `/verify` checks its
  signature (HMAC-SHA256 of `order_id|payment_id` with the key secret).
  It then reads the order and the payment from Razorpay and checks that
  they belong together, to this reference, in this currency, for this
  amount. Razorpay's own payment status sets the state; a valid signature
  on an uncaptured payment is **processing**, not success.
- **Webhooks** are trusted only after the `X-Razorpay-Signature` check
  (HMAC-SHA256 of the raw body with the webhook secret), and only for an
  order that is ours (our reference in both its `receipt` and its notes).
- **No database.** Razorpay is the record. Our reference is the order's
  `receipt`, and the donor's form details are in the order's `notes`.
  State is read back from Razorpay whenever it is needed. Nothing required
  a database, so none was added.
- **Money** is integer minor units throughout (`src/lib/money.js`). A human
  amount becomes minor units once, by string arithmetic, with no floating
  point.

## Files

| Path | What |
| --- | --- |
| `server/donations/config.mjs` | Server configuration from the environment; fails closed |
| `server/donations/handler.mjs` | The five endpoints (platform-neutral Fetch API handler) |
| `server/donations/razorpay.mjs` | Razorpay REST calls; payment and webhook signature checks |
| `server/donations/state.mjs` | The state model, read from Razorpay records |
| `server/donations/wording.mjs` | RBB-approved email wording slots (all empty) |
| `server/email/templates.mjs` | Donation email templates, next to the form templates |
| `server/email/deliver.mjs` | The one sending path (EMAIL_MODE rules), shared with the forms |
| `src/lib/money.js` | Minor-unit parsing and formatting, shared by browser and server |
| `src/lib/donations.js` | Browser client for the endpoints; lazy Checkout loader |
| `src/components/DonationCheckout/` | The amount selector, donor fields and result states |
| `scripts/check-razorpay-checkout.mjs` | `npm run check:razorpay` — CSP drift check against live `checkout.js` |
| `server/test/donations.test.mjs` | 31 tests — `npm run test:server` |

## States

| State | Meaning | Donor sees |
| --- | --- | --- |
| `created` | Order made, nothing attempted | — |
| `checkout_opened` | Checkout window open (browser only) | "Complete your payment in the Razorpay window." |
| `authorized` | Bank approved; not captured | "Being confirmed" — the page polls the server |
| `captured` | Verified by the server | The only success message |
| `failed` | Attempt(s) failed | Retry or change details; no claim about charges |
| `cancelled` | Window closed first (browser only) | Retry, with no failure claim |
| `refunded` | Refund processed per Razorpay | (email only) |
| `unknown` | Cannot be read safely | Never success. The page keeps the reference, points to Contact and polls |

## Idempotency

- **Order:** the browser sends one `Idempotency-Key` per attempt. A repeat
  of that key returns the same order (in memory, per instance). The button
  also ignores repeat clicks. A retry after "cancelled" or "failed"
  reopens the **same** order. An unpaid duplicate order can only occur on
  a second instance, and it simply expires unpaid.
- **Emails:** each email has a key derived from the payment or refund id,
  such as `donation:<payment_id>:success`. `/verify` and the webhook may
  both see one payment, on different instances; Resend de-duplicates by
  key for 24 hours, so each email goes out once. An in-memory set also
  skips repeat sends within one instance. The "failed" email is keyed on
  the order, so a donor hears about it at most once.
- **Webhook events:** `x-razorpay-event-id` values already handled are
  acknowledged without being processed again. If an email fails for a
  transient reason, the webhook answers 503 so Razorpay redelivers. The
  keys make sure the retry sends only what is missing.

## Webhook events

| Event | Acts as |
| --- | --- |
| `payment.captured`, `order.paid` | captured → RBB notice + donor thanks |
| `payment.authorized` | processing → donor "being confirmed" |
| `payment.failed` | failed → donor "not completed". Skipped if the order has since been paid |
| `refund.processed` | refunded → RBB notice + donor refund email (refund must be `processed`) |
| anything else | 200, logged as ignored, never processed |

In the Razorpay dashboard, subscribe the webhook to exactly those five
events. Use `https://<domain>/api/donations/webhook` and a webhook secret
that is **different for test and live**.

## Emails (reuse Document 21's Resend client and `EMAIL_MODE`)

| Template | To | Sent when |
| --- | --- | --- |
| Donation received | RBB (`EMAIL_TO_DONATIONS`) | captured |
| Thank you for your donation | donor | captured; `success` in `DONATION_DONOR_EMAILS` |
| Your donation is being confirmed | donor | authorized; `processing` enabled |
| Your donation was not completed | donor | failed; `failed` enabled |
| Your donation has been refunded | donor + RBB notice | refund processed; `refunded` enabled |

All of them are HTML plus plain text, in the Document 21 layout, with
visitor text escaped. Test-mode payments are marked `[Razorpay test]` in
every email. They contain no signature, card, bank or UPI details, and no
provider payload. **No tax, receipt, refund-policy, purpose or support
line** appears until RBB supplies it (`server/donations/wording.mjs`). The
rest of the wording is proposed, and every donor email is off until RBB
approves it.

## Configuration

Server-side (the host's secret store; names in `server/env.example`):
`DONATION_ENABLED`, `RAZORPAY_MODE`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `DONATION_CURRENCY`,
`DONATION_MIN_AMOUNT`, `DONATION_MAX_AMOUNT`, `DONATION_ALLOWED_AMOUNTS`,
`DONATION_CUSTOM_AMOUNT`, `DONATION_EMAIL_ENABLED`, `EMAIL_TO_DONATIONS`,
`DONATION_DONOR_EMAILS`, plus Document 21's `EMAIL_MODE`, `EMAIL_API_KEY`,
`EMAIL_FROM`, `ALLOWED_ORIGIN`, `RATE_LIMIT_*`.

Build-time (public): `VITE_DONATIONS_API=/api/donations`.

**Test/live separation.** Donations are off unless `DONATION_ENABLED=true`.
`RAZORPAY_MODE` must be `test` or `live`, with no default, and the key id
must match it (`rzp_test_…` / `rzp_live_…`). If they do not match,
donations switch off: there is **no fallback in either direction**. A
missing secret, currency or bound also switches them off. Webhooks from
the other mode cannot be read with this mode's key, so they are ignored.
Local tests use `EMAIL_MODE=test` and send nothing.

## Content Security Policy

Only the donation page's policy changes, and only in a build with checkout
on. Verified in Chromium under an enforced policy:

| Directive | Added |
| --- | --- |
| `script-src` | `https://checkout.razorpay.com` (Checkout), `https://cdn.razorpay.com` (its risk-detection bundle) |
| `frame-src` | `https://api.razorpay.com` (was `'none'`) |
| `connect-src` | `https://lumberjack.razorpay.com` (Checkout telemetry) |
| `style-src-elem` | Razorpay's two fixed `<style>` blocks, by exact hash |
| `style-src-attr` | `'unsafe-inline'`. Checkout sets viewport-dependent `style` attributes from script, which hashes cannot follow. Donation page only; a style attribute cannot run script |

Other details:

- Everything else Checkout loads runs inside the `api.razorpay.com` frame,
  under Razorpay's own policy.
- Every other page keeps its original policy. A test confirms the home
  page still refuses `checkout.js`.
- With checkout on, the **header** CSP is the donation page's wider
  policy, because most hosts cannot give one path its own CSP header. Each
  page's `<meta>` CSP, which the browser enforces as well, keeps the other
  pages strict.
- `Cross-Origin-Opener-Policy` becomes `same-origin-allow-popups` so that
  payment-method windows can report back.

**Before launch, with Razorpay test keys:**

1. `npm run check:razorpay`. Both style blocks should say "unchanged".
2. Build with `RBB_CSP=report-only VITE_DONATIONS_API=/api/donations`.
3. On a staging host, complete test payments by card, UPI, netbanking and
   a 3-D Secure card.
4. Record any violation. So far only the Checkout window has been opened,
   with a placeholder key; real payment flows need real test keys.
5. Update `RAZORPAY` in `scripts/security-policy.mjs` only for origins
   actually reported, then enforce.

## Recurring donations

These are not built and not enabled. The architecture leaves room for
them: a Razorpay Subscriptions plan created server-side, `subscription.*`
webhook events added to the event table, verified and idempotent in the
same way, and separate approved wording. No repeated one-time charges and
no stored card or bank data, ever.

## Reconciliation

One JSON log line per step contains: `at`, `mode`, `reference`, `event`,
`orderId`, `paymentId`, `refundId`, `amount`, `currency`, `state`, and
email outcomes. It never contains a name, email, phone, signature,
payload or secret. Match these lines against the Razorpay dashboard by
reference (the order receipt). Log retention is set by the host and is
**still to be decided**.

## Activation — all required

- [ ] Production Razorpay account; live Key ID, Key Secret and webhook secret, stored only in the host's secrets.
- [ ] Automatic capture enabled in the Razorpay dashboard (otherwise payments stay "processing").
- [ ] Currency, minimum/maximum, presets and whether custom amounts are allowed.
- [ ] One-time donations approved; recurring decided (off).
- [ ] Donation purpose/designation options, if any (none built).
- [ ] Donor fields approved (proposed: name, email, optional phone).
- [ ] Tax/receipt wording if applicable, refund wording, support route, purpose line → `server/donations/wording.mjs`.
- [ ] Donor email wording approved → `DONATION_DONOR_EMAILS`.
- [ ] Approved From address (Document 21) and `EMAIL_TO_DONATIONS`.
- [ ] Privacy Policy published, covering Razorpay and Resend as processors.
- [ ] Production host running the handler at `/api/donations/*`; rate limiting on the platform or a shared store. Live mode stays off otherwise (Document 25, `RATE_LIMIT_STORE`).
- [ ] Webhook configured (five events, separate test and live secrets).
- [ ] Test-mode run end to end on staging; CSP re-verified as above.
- [ ] Content: `DONATION.status = "approved-live"`, `donationAction.checkout.status = "approved"`, `VITE_DONATIONS_API=/api/donations`, rebuild.
- [ ] `docs/TECHNOLOGY_AUDIT.md` updated after an audit of the live page.
