# Donations

How online donations stand on the Rising Beyond Borders site. **Donations
are OFF, and no payment provider is integrated.** RBB is choosing a new
provider; until it is chosen and wired in, the site takes no payment.

## States (`src/content/donation.js`)

| `DONATION.status` | The page shows |
| --- | --- |
| `pending` | The donation form as a no-payment **preview** (below) |
| `approved-informational` | RBB's approved giving information; no payment |
| `approved-live` | A **link out** to RBB's verified payment provider's own hosted page: `donationAction.live: { heading, body, label, url, provider }` |

`donationState()` falls back, never forward: `approved-live` without a
`url` and `provider` drops to informational or pending. There is no
on-page checkout state.

## The preview (while donations are pending)

`components/DonationForm`, drawn from `checkout.preview`. It appears
in two places:

- the header's **Donate** popup (`components/DonateDialog`), on every page;
- the donation page, **`/appeals`** (via `DonationAction`).

The individual appeal pages (`/appeals/emergency/*`,
`/appeals/campaigns/*`) have **no** donation form; their "Donate to this
appeal" button opens the popup.

What the preview does and does not do:

- **It takes no payment and makes no request.** Nothing is loaded from any
  provider.
- **Submitting** runs the form's own checks, then says giving is not open
  yet. It never shows success and never shows a reference.
- **Typed details are not kept.** They live in React state only: nothing
  is stored, logged or emailed.
- **The submit button is disabled until the page hydrates**, so a native
  submit cannot send typed details to the page's URL.
- **One-time only.** No Monthly option; recurring giving is not offered.
- **The amounts and currency are placeholders.** The currency is ISO 4217
  `XXX` ("no currency"). These are not proposals: the real values come
  from the server once a provider is live (D26, D27).
- **`npm run release:check` blocks production** while the preview is on
  the page. It reads both `readiness.donation.preview` and the
  `data-donation-preview` marker on `/appeals`. To launch, either open
  donations (`approved-live`) or remove `checkout.preview` to launch
  without online donations (D31).

## Release evidence

- `paymentProviderVerified` (`release/approvals.mjs`): RBB's chosen
  provider verified end to end in test mode — success, failure, cancel.
  With donations `approved-live`, `release:check` blocks until it has
  passed.
- `liveCredentialsConfigured`: live payment-provider and Resend
  credentials in the host's secrets, never in the repo.
- Without live donations, production needs the approved `donation`
  launch decision (D31).

## What was removed

The Razorpay integration (Document 22) was removed in full when RBB moved
to a different, not-yet-chosen provider: `server/donations/` (config,
handler, Razorpay client, state model, wording slots), its tests,
`src/lib/donations.js`, `scripts/check-razorpay-checkout.mjs` and
`npm run check:razorpay`, the donation email templates, every
`/api/donations/*` endpoint, the `VITE_DONATIONS_API`, `DONATION_*`,
`RAZORPAY_*` and `EMAIL_TO_DONATIONS` variables, and the Razorpay CSP
relaxations (its origins, style hashes, `style-src-attr 'unsafe-inline'`
and `same-origin-allow-popups`). Every page now has the strict policy. The
release evidence `razorpayTestE2E`, `razorpayWebhookTest` and
`razorpayCspReverified` became `paymentProviderVerified`. The leaked
credential scanner (`src/lib/releaseMarkers.js`) still refuses Razorpay
keys and secret names in a build, as a safety net.

## Wiring a new provider (document each piece here as it is added)

1. **The form.** Replace what `onSubmit` in `DonationForm` does after
   validation — the provider's own checkout, or a hand-off to its hosted
   page. The server, not the bundle, supplies the real amounts and
   currency.
2. **The server.** Any endpoint goes in `server/` and is mounted in
   `createServerApp` (`server/app.mjs`), which today mounts only
   `/api/forms`. Payment state is decided on the server from the
   provider's records, never from a browser callback.
3. **CSP.** Add the provider's exact origins (verified in a browser, not
   guessed) to `scripts/security-policy.mjs`. None is allowed today.
4. **Configuration.** Secrets are server variables in the host's secret
   store (names in `server/env.example`), never `VITE_*`. Test and live
   stay separate, with no fallback between them.
5. **Evidence.** Record `paymentProviderVerified`, then
   `liveCredentialsConfigured`; set `DONATION.status = "approved-live"`.
6. **Records.** Update `docs/TECHNOLOGY_AUDIT.md`, `docs/SECURITY.md` and
   the Privacy Policy (the provider as a processor).
