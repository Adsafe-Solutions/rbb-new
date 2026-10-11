# Givebutter integration spike (M3.5)

What was proven, what Givebutter exposes, and what the donation CMS milestone
must decide. These are findings, not product copy.

## Who owns what

| | RBB | Givebutter |
|---|---|---|
| Server side (`apps/api`) | Campaign discovery through the provider boundary; later, campaign mapping and webhooks | The API, with key auth |
| Browser (`apps/web`) | The page around the checkout; which widget appears where | The widget library and checkout: amounts, payment methods, card entry, recurring billing, receipts |
| Data | Editorial content; campaign and widget identifiers | Donors, payments, transactions |

No payment data passes through RBB code, the API or MongoDB.

**Secrets:**
- `GIVEBUTTER_API_KEY` is server-side only (`apps/api`).
- The widget **account id** is public (`VITE_GIVEBUTTER_ACCOUNT_ID`).
- There is no `VITE_` variable for the key, and there must never be one.

## API (verified with the real account, read-only)

- **Base and auth:** `https://api.givebutter.com/v1`, with
  `Authorization: Bearer <key>`.
- **Campaign list:** `GET /campaigns?page=N` returns `{ data, links, meta }`,
  20 per page; `meta.current_page` and `meta.last_page` drive paging.
- **Single campaign:** `GET /campaigns/{id}` returns the campaign itself
  **unwrapped**, with no `data` envelope (it differs from the list).
- **Campaign fields used:**
  - `id` (number), `code` (public, e.g. in the URL), `account_id`
  - `type` (`collect`, …), `status` (`active`, `unpublished`, …), `title`
  - `url`, `goal`, `raised`, `donors`, `currency`, `end_at`, `updated_at`
  - `settings[]`
- **Settings:** `[{ name, value }]`. The value can be a boolean, string, array
  or object, and the shape can differ between campaigns. Checkout options
  are readable:
  - `display_frequencies` (e.g. `once`, `monthly`, `quarterly`)
  - `default_frequency`
  - `custom_donation_amounts` (preset amounts per frequency)
  - `minimum_donation`
- **Errors:**
  - 401 returns `{ error }`, and 404 returns `{ message }`; the shapes are
    inconsistent.
  - Documented 422 bodies are `{ message, errors }`.
  - 429 carries `Retry-After`.
- **Rate limit:** the live API reported `x-ratelimit-limit: 200`, while the
  docs state 60/min (standard plan). Treat the docs' lower figure as the
  budget.
- **Account id:** `account_id` on a campaign equals the widget account id,
  so it can be discovered rather than typed in.

## Identifiers: three different things

| Identifier | Example (this account) | Where it comes from |
|---|---|---|
| Campaign id | `758500` | API `id` |
| Campaign code | `GN49PE` | API `code`; the campaign URL |
| Widget id | `jNKkQk` | Dashboard only. Not in the API |

The widget `jNKkQk` renders campaign `GN49PE`. This was confirmed in the
browser: its frame is `givebutter.com/…/c/rbb-general-giving-gn49pe`, and its
amounts and frequencies match the API. The API cannot list widgets or map a
widget to its campaign.

The current docs also show **campaign-code** elements, such as
`<givebutter-giving-form campaign="CODE">` and
`<givebutter-button campaign="CODE">`. Those would need no widget id at all.
The dashboard issued the widget-id form (`<givebutter-widget id>`), and only
that form was verified here.

## Widget (verified in a browser)

- **Library:** `https://widgets.givebutter.com/latest.umd.cjs?acct=<account>&p=other`.
  The URL is unpinned (`latest`), the file is about 270 KB decoded, and it's
  cached for 1 hour. It's loaded once, from `src/integrations/givebutter/loader.js`,
  and only on pages that render a widget.
- **Rendering:** the checkout renders in a shadow root as an iframe from
  `givebutter.com`, auto-resized and keyboard reachable. It survives
  client-side navigation away and back with one library script, and causes
  no overflow at 375 px or 1280 px.
- **Parameters** (documented): `amount`, `frequency`, `fund` and `promo`
  preselect *existing* campaign options; they cannot create new ones.
  `GivebutterForm` passes `amount` and `frequency` only, after validating them.
- **Events** (documented): `window.Givebutter.on('widgetLoaded' |
  'checkoutStarted', …)`, with campaign, UTM and widget details. **Not
  verified:** `window.Givebutter` was undefined in testing, and the events
  doc page was returning 404.
- **UTM:** Givebutter records UTM parameters, per its URL-parameter docs. A
  future analytics milestone can tag each entry point (navbar Donate, story
  CTA, appeal page, QR codes) with distinct `utm_*` values, without a
  custom system.
- **Inside the checkout frame**, governed by Givebutter's policy, not RBB's:
  Stripe, Google Analytics/GTM, Cloudflare Insights/Turnstile, PostHog
  (`ph.givebutter.com`), Google Maps and FontAwesome. These run in
  Givebutter's document, not RBB's, but the privacy policy should say that
  donating happens on a Givebutter-hosted checkout.

## CSP

The allowance is `scripts/security-policy.mjs` `DONATION_WIDGET`. It's added
**only** to the policy of a page that contains a `<givebutter-…>` element.
Since M7 that is a donation page whose CMS record has a verified Givebutter
checkout (see "M7" below), and nothing else.

| Directive | Origin | Why |
|---|---|---|
| `script-src` | `widgets.givebutter.com` | The library |
| `connect-src` | `widgets.givebutter.com`, `givebutter.com` | Its configuration and data fetches |
| `img-src` | `givebutter.com` | An image it renders |
| `frame-src` | `givebutter.com` | The checkout |
| Permissions-Policy `payment` | `givebutter.com` | The checkout frame's Apple Pay / Google Pay |

**Open decision: inline styles.** The library writes three `style="…"`
attributes and one `<style>` element, which the site's policy blocks:

- **Effect:** none visible. The checkout renders at its proper width and
  height.
- **Cost:** 4 CSP reports on each widget load.

The options:
1. **Keep them blocked (current).** Secure, but produces console noise.
2. **Hash-allow them.** The hashes are fragile: one of them includes the
   widget's height, and the library is the unpinned `latest`.
3. **Allow `'unsafe-inline'` for styles on widget pages only.** The site's
   existing style hashes would have to be dropped on those pages, because
   browsers ignore `'unsafe-inline'` when hashes are present.
4. **Use Givebutter's plain iframe embed instead of the library.** It needs no
   script, but loses auto-resize. Unverified.

## M7: CMS-managed checkouts (what changed, what was observed)

- **Configuration:** appeals and the general donation page carry an optional
  `donation.checkout` (`DonationCheckout` in `packages/content-schema`), the
  shape recommended below. Public identifiers only.
- **Verification:** server-side, through `DonationProvider.getCampaign`
  (`apps/api/src/modules/donations/verify.ts`). It runs when a page is saved
  as published with a new checkout, and again for every checkout when an
  owner publishes the website. A failure blocks it, and the live snapshot
  stays.
- **Website:** a page with a checkout draws Givebutter's Form widget in the
  form slot (`components/DonationCheckoutCard`). Otherwise it draws the site's
  own form. The library is loaded after hydration, once, only on those pages.
- **Account id:** the build's `VITE_GIVEBUTTER_ACCOUNT_ID`. Without it, the
  build warns and pages keep the site's own form.

**Observed in the M7 browser smoke** (local build, real campaign 758500 and
widget jNKkQk). Unchanged policy; reported, not weakened:

| Finding | Where | Status |
|---|---|---|
| `style-src-elem` / `style-src-attr` CSP reports from the library's inline styles | only the two widget pages | The open decision above. Still blocked, with no visible effect |
| Cookies set on `.givebutter.com`, `.givebuttercdn.com`, `m.stripe.com` | the checkout frame | **Needs a decision** (cookie notice/consent) before giving goes live |
| Requests from inside the checkout frame to `js.givebutter.com`, `givebuttercdn.com`, `ph.givebutter.com`, Stripe, Braintree, Cloudflare Turnstile/Insights, Font Awesome, Google Maps, **Google Analytics / Tag Manager**, **Facebook** (`connect.facebook.net`) | inside Givebutter's frame (its own policy) | **Needs a decision**: check the campaign's tracking settings in Givebutter, and the privacy notice |

The site's own documents made **no** unapproved third-party request on any
route. `scripts/smoke-test.mjs` now lists the provider frame's requests
separately and keeps that check failing until the decision is made.

## Webhooks (documented, not implemented)

- **Management:** webhooks are created and listed through the API
  (`POST /v1/webhooks`).
- **Events:** `campaign.created`, `campaign.updated`, `ticket.created`,
  `transaction.succeeded`, `contact.created`, `plan.created`,
  `plan.updated`, `plan.canceled`, `plan.failed`, `plan.paused`,
  `plan.resumed` and `refund.created`.
- **Payload:** `{ id, type, created_at, data, account_id }`.
- **Delivery:** retried 5 times (1 min → 12 h), then disabled; a 200 response
  is required within 10 s.
- **Signatures — unclear:**
  - The webhook object returns a `signature` field.
  - One docs page names an `x-givebutter-signature` header.
  - Another labels webhooks as "coming soon".
  - The verification algorithm isn't documented.

  Verify this before building the ledger.
- **Fitness for the ledger:** `transaction.succeeded` and `refund.created`
  would feed a future donation ledger; the plan events would track
  recurring giving.

## Future CMS contract (recommendation)

The checkout is a **controlled slot** on a donation page, not a content block:

```
{ provider: "givebutter", campaignId: "758500", widgetId: "jNKkQk", widgetType: "form",
  defaultAmount?: number, defaultFrequency?: "once" | "monthly" | "quarterly" | "yearly" }
```

- `campaignId` comes from **Sync campaigns** (the API), so title, status,
  goal and checkout options are never copied by hand.
- `widgetId` is typed in from the dashboard, because the API can't list
  widgets. The admin can't check that it belongs to the campaign; the
  browser shows the truth.
- Optional defaults are validated against the synced campaign's
  `checkout.frequencies` and `checkout.amounts`.
- `accountId` is deployment configuration (and discoverable), not per page.
- Givebutter stays the source of truth for goal and raised. Show its Goal Bar
  widget, or read the values through the API; don't store them.
