# Admin content — Policies

Values for every field of the Admin's policy editor (Content → Policies →
Privacy Policy / Terms of Use / Donation Policy). The three policies
already exist as records with fixed ids and addresses; an editor cannot
add, rename or move one. Cookies has no page (decision D24).

> **This section is different from the others: the words are RBB's, not
> the website's.** The website's current policy pages hold WORKING
> PLACEHOLDER text ("Demo — …", `apps/web/src/content/policies.js`),
> shown with a note that it is not RBB's policy. **That text cannot be
> entered:** the CMS refuses working text at Submit, Approve and Publish,
> and the website build refuses it too. Nothing below is legal wording and
> none may be written on RBB's behalf (decision D23): the structure,
> headings and what each section should cover come from the website's
> outline (Document 13); the paragraphs are typed in **as supplied by RBB
> and reviewed by counsel**. Until a policy is published, its page shows
> the website's neutral "being updated" line and has no footer link.

## Where each field shows on the website

| Form field | Where it appears |
| --- | --- |
| Title | The policy page heading (`/privacy`, `/terms`, `/donation-policy`), kicker "Site policies"; the footer's legal links (shown as "Privacy", "Terms", "Donation Policy") once published |
| Effective date, Last updated | The "Effective" / "Last updated" lines under the heading (both required to approve; RBB's dates, never a deploy date) |
| Introduction | Lead paragraphs above the sections |
| Sections — Heading | The section heading and the "On this page" contents list |
| Sections — Anchor | The section's address, e.g. `/privacy#information-collected` (links in forms and other pages point at these — keep the anchors below) |
| Sections — Paragraphs, Bullet list | The section's text and optional list |
| Contact for questions | "Questions about this policy": one of the contact methods from Settings, shown while it is in the published settings — never a typed address |
| Related policies | "Related policies" links at the end, only while those policies are published |
| SEO description | The page's meta description (the website's own is used when empty) |

Also driven by publication: the forms' "privacy" link and consent text
point at `/privacy` once the Privacy Policy is published; the donation
form's "Questions about giving" links to `/donation-policy`.

Workflow: Save → **Submit for review** → owner **Approve** (needs both
dates and at least one section, and no working text) → website
**Publish**. A published policy is final: the website shows it as RBB's
own text.

---

## 1. Privacy Policy

### Basic information

| Field | Value |
| --- | --- |
| Title | `Privacy Policy` |
| Effective date | RBB's date, `YYYY-MM-DD` (e.g. the date counsel approved it) |
| Last updated | RBB's date, `YYYY-MM-DD` (same as effective for a first version) |
| Introduction | 1–2 lead paragraphs **from RBB**: who the policy is from (Rising Beyond Borders), what it covers (this website and the forms on it), and that it should be read with the Terms of Use |

### Sections — in this order (headings and anchors from the website's outline; text from RBB)

| # | Heading | Anchor | What RBB's paragraphs need to cover |
| --- | --- | --- | --- |
| 1 | `Introduction and scope` | `introduction` | Which website and services the policy applies to; who the data controller is |
| 2 | `Information we collect` | `information-collected` | What the site actually collects today: contact form (name, email, message), volunteer / partner / travel / fundraise forms, newsletter sign-up (email), donation details handled by the payment provider. Bullet list optional: one item per form |
| 3 | `How we use information` | `use` | Answering messages, processing a donation, sending news only when asked |
| 4 | `Sharing and service providers` | `sharing` | The providers RBB actually uses (email delivery, payment provider, hosting) — named by RBB, not guessed |
| 5 | `Forms and communications` | `forms` | What happens to a submitted form; consent for the newsletter; how to unsubscribe |
| 6 | `Cookies and similar technologies` | `cookies` | What the production site sets, from the technology audit (`apps/web/docs/TECHNOLOGY_AUDIT.md`): the site's own code sets no cookies; Google Fonts is loaded on every page; hosting/CDN behaviour as assessed |
| 7 | `Data retention` | `retention` | Retention periods RBB decides |
| 8 | `Security` | `security` | What RBB can truthfully say about safeguards |
| 9 | `Your rights and choices` | `rights` | Access, correction, deletion, withdrawing consent, how to ask |
| 10 | `International transfers` | `transfers` | **Only if RBB/counsel confirm it applies**; otherwise leave the section out |
| 11 | `Privacy questions` | `contact` | How to contact RBB about privacy (the "Contact for questions" field below shows the address; the paragraph can simply say to use it) |
| 12 | `Updates to this policy` | `updates` | That changes are shown by the "Last updated" date |

Each section: Heading as above, Anchor as above, Paragraphs = RBB's text
(blank line between paragraphs), Bullet list only where RBB's text has a
list.

### Contact for questions
Choose the privacy or general mailbox from Settings (it must exist in
**Settings → Contact** first — see the Settings section of these docs).
`No contact` if none is published yet.

### Related policies
- ☑ `Terms of Use`
- ☑ `Donation Policy`

### SEO
| Field | Value |
| --- | --- |
| SEO description | `The Rising Beyond Borders privacy policy: what information this website collects, how it is used and your choices.` (116 chars) — or leave empty for the website's own ("The Rising Beyond Borders privacy policy.") |

---

## 2. Terms of Use

### Basic information

| Field | Value |
| --- | --- |
| Title | `Terms of Use` |
| Effective date | RBB's date, `YYYY-MM-DD` |
| Last updated | RBB's date, `YYYY-MM-DD` |
| Introduction | 1 lead paragraph **from RBB**: that these terms govern use of the Rising Beyond Borders website, and that using it means accepting them |

### Sections — in this order

| # | Heading | Anchor | What RBB's paragraphs need to cover |
| --- | --- | --- | --- |
| 1 | `Acceptable use` | `acceptable-use` | Lawful use; no attempts to disrupt, scrape or misuse the site |
| 2 | `Intellectual property` | `intellectual-property` | Who owns the text, images and the RBB mark; what may be reused and how |
| 3 | `External links` | `external-links` | Links to other sites are not endorsements; RBB is not responsible for them |
| 4 | `Website availability` | `availability` | No guarantee of uninterrupted availability; content may change |
| 5 | `Disclaimers` | `disclaimers` | Information is general, not professional advice |
| 6 | `Limitation of liability` | `liability` | As counsel advises |
| 7 | `Governing law` | `governing-law` | **Only once counsel states the jurisdiction** — nothing supplied establishes one; leave the section out until then |
| 8 | `Changes to these terms` | `changes` | Changes are shown by the "Last updated" date |

### Contact for questions
The general contact method from Settings, or `No contact`.

### Related policies
- ☑ `Privacy Policy`
- ☑ `Donation Policy`

### SEO
| Field | Value |
| --- | --- |
| SEO description | `The terms of use for the Rising Beyond Borders website.` (55 chars) — this is also the website's own, so it may be left empty |

---

## 3. Donation Policy

### Basic information

| Field | Value |
| --- | --- |
| Title | `Donation Policy` |
| Effective date | RBB's date, `YYYY-MM-DD` |
| Last updated | RBB's date, `YYYY-MM-DD` |
| Introduction | 1 lead paragraph **from RBB**: what the policy explains — how donations are received, used, acknowledged and refunded |

### Sections — in this order

| # | Heading | Anchor | What RBB's paragraphs need to cover |
| --- | --- | --- | --- |
| 1 | `About this policy` | `introduction` | Scope: donations made through this website and its appeals |
| 2 | `How donations are used` | `use-of-donations` | How general donations are applied across the four program areas (Education, Health & Wellbeing, Livelihoods, Community Support) |
| 3 | `Appeals and campaigns` | `appeals` | What happens when an appeal raises more, or less, than it needs |
| 4 | `Payments` | `payments` | How payments are processed; that card and bank details go to the payment provider, not this website (name the provider RBB has chosen — decision D31) |
| 5 | `Receipts and acknowledgements` | `receipts` | How and when donors receive confirmation; any tax-receipt wording **only with tax/legal confirmation** (D29) |
| 6 | `Refunds` | `refunds` | How to ask for a refund and within what period (D29) |
| 7 | `Your personal information` | `personal-information` | How donor details are handled; refer to the Privacy Policy |
| 8 | `Questions about giving` | `contact` | How to contact RBB about a donation |

### Contact for questions
The donations or general contact method from Settings, or `No contact`.

### Related policies
- ☑ `Privacy Policy`
- ☑ `Terms of Use`

### SEO
| Field | Value |
| --- | --- |
| SEO description | `How donations to Rising Beyond Borders are received, used, acknowledged and refunded.` (85 chars) — also the website's own, so it may be left empty |

---

## The same content as an array of objects

`docs/admin-content/policies.json` holds the three policies as an array
in the CMS's own shape (`id`, `title`, `effectiveDate`, `lastUpdated`,
`intro[]`, `sections[{ id, heading, body[], items[] }]`,
`contactReference`, `relatedPolicies[]`, `seo.description`) — one object
per policy, sections in page order with the anchors above, and DRAFT
paragraph wording that sticks to what the website verifiably does.
Every fact only RBB can state is a `[RBB to confirm: …]` placeholder
(dates, provider names, retention and refund periods, liability,
jurisdiction). Replace each placeholder and remove the "DRAFT FOR
REVIEW" intro line after counsel's review; the "Limitation of liability"
section has no draft wording at all, and "International transfers" /
"Governing law" are left out until confirmed.

## Checklist before publishing

- [ ] Text supplied by RBB and reviewed by counsel; no "Demo —" wording anywhere (the CMS refuses it). `[RBB to confirm: …]` placeholders are NOT refused (decision, 2026-10-13): they publish as written, so replace them before publishing.
- [ ] Both dates set to RBB's dates.
- [ ] Section anchors exactly as listed (other pages and forms link to them).
- [ ] "Transfers" and "Governing law" sections included only if confirmed.
- [ ] Contact method chosen from Settings (published), not typed in.
- [ ] Submit → Approve → Publish each policy; then check the footer's legal links, `/privacy`, `/terms`, `/donation-policy`, and a form's privacy link.
