# RBB content decision register

Decisions that **Rising Beyond Borders must make and approve explicitly**
before launch. None has been made on RBB's behalf. Opened 2026-10-04.

For each decision, the register records what is on the site now and what
RBB needs to supply. It also gives the file to change and the approval
area in `release/approvals.mjs` where the decision is recorded (who, date,
reference). **Every decision below is OPEN.**

The page-by-page view is `docs/FINAL_CONTENT_REPLACEMENT_CHECKLIST.md`.

| # | Decision | On the site now | What RBB must decide or supply | File | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | **50K+ lives impacted** | Shown, stamped "Pending verification", never animated | Verify (with the source and what "lives impacted" counts), or withdraw | `content/impact.js` | impact | OPEN |
| D2 | **25 countries reached** | Shown, stamped "Pending verification" | Verify, or withdraw. If verified, Where We Work must list the same countries | `content/impact.js` | impact | OPEN |
| D3 | **200+ partners & donors worldwide** | Shown, stamped "Pending verification" | Verify (partners and donors counted together?), or withdraw | `content/impact.js` | impact | OPEN |
| D4 | **"120+" figure** from the annual report | Excluded: its label conflicts and its meaning is unknown | Define what it counts, or confirm it stays off the site | `content/impact.js` | impact | OPEN |
| D5 | **Financial shares 78% / 12% / 10%** (2026: Programs & Services / Fundraising / Administration) | Shown on `/about#transparency`, each stamped "Pending verification"; no amounts | Verify against approved accounts and name the source, or withdraw. No monetary values, audit or tax wording without separate approval | `content/transparency.js` | financials | OPEN |
| D6 | **Annual reports and financial documents** | None listed ("to be provided") | Supply the approved files and decide which to publish | `content/transparency.js` | financials | OPEN |
| D7 | **Governance information** | Nothing: the pending line shows (the demo board/policies text was removed 2026-10-04) | Approved governance statement and documents, or none | `content/transparency.js` | financials | OPEN |
| D8 | **Organization description and positioning** | Annual-report summary and description. **Proposed** (content brief 2026-10-04): hero "Opportunity for all. Stronger communities. Changing lives." and its supporting line, and the inclusive, non-religious About copy. The annual report's "Building Hope. Creating Change. Transforming Lives." is the source alternative | Confirm, or supply final wording; supply the homepage supporting line (currently empty) or confirm none | `content/brand.js`, `content/homepage.js`, `content/about.js` | coreIdentity | OPEN |
| D9 | **Mission and vision** | Annual-report wording | Confirm as final | `content/about.js` | coreIdentity | OPEN |
| D10 | **Values** | 6 **proposed** values (Dignity, Inclusion, Compassion, Collaboration, Accountability, Sustainability), headed "What guides our work", not presented as formally adopted | Supply RBB's own values and descriptions | `content/about.js` | coreIdentity | OPEN |
| D11 | **How-we-work wording** | **Proposed** general prose (listening, collaboration, sustainability, learning) and six principles; Listen → Partner → Act → Sustain **hidden** and removed from `about.js` | Supply the approved description. Approve or reject the four-step framework as RBB's official method | `content/about.js`, `content/impact.js` | programs | OPEN |
| D12 | **Program details** (why, activities, outcomes, stories) for the 4 programs | **Proposed** general copy per program ("why", focus areas, "the change we work towards"), with no figures, places or projects. Stories still point at demo stories | Supply per program; outcomes only with verified sources | `content/work.js`, `content/impact.js` | programs | OPEN |
| D13 | **Projects** | 10 demo projects, demo locations, figures and partners | Supply real projects (title, program, location, status, description, verified impact, partners with consent, photo), and approve each for publication | `content/work.js` | programs | OPEN |
| D14 | **Countries and regions served** | Demo regions and "Demo country A–F"; page `noindex` | Supply the approved list. Decide whether a map is wanted (only after the list exists) | `content/impact.js` | geography | OPEN |
| D15 | **Stories** | 8 demo stories | Supply real stories with consent for names, quotes and photographs; approve each | `content/stories.js` | stories | OPEN |
| D16 | **Team** | 6 fictional people, stock portraits | Supply real team members (name, role, bio, photo, with consent); decide who gets a profile page and whether social links are shown | `content/team.js` | team | OPEN |
| D17 | **Contact details** | Nothing: the demo values were removed 2026-10-04 and every contact surface shows the pending line | Supply the real email, phone (or none), address (or none), hours and response time (or none) | `content/contact.js` | contact | OPEN |
| D18 | **Social links** | None shown (the platform home-page stand-ins were removed 2026-10-04) | Supply RBB's actual account URLs; remove any platform not used | `content/contact.js`, `content/footer.js` | contact | OPEN |
| D19 | **Careers** | No roles and no careers contact; one proposed "why work with us" line | Supply real openings, or decide on a "no current openings" state; how to apply | `content/contact.js` | contact | OPEN |
| D20 | **Get Involved paths** | Donate, Volunteer, Partner, Fundraise with **proposed** descriptions and "why" text. Every operational section (roles, eligibility, process, rules, FAQs) shows its pending line. Fundraise is still marked `placeholder` | Confirm all four paths are offered; supply content and FAQs for each | `content/getInvolved.js` | forms | OPEN |
| D21 | **Form wording and recipients** | Live forms with demo success/error messages and demo consent | Approve fields, consent wording, success/error wording and the inbox for each form | `content/forms.js`, server env | forms, email | OPEN |
| D22 | **Newsletter** | Form and demo consent | Choose a provider and consent wording, or retire the newsletter | `content/forms.js` | email | OPEN |
| D23 | **Legal text: Privacy, Terms** | Pages show their pending line; the working demo text is held back (`isFinalPolicy`) and the pages are `noindex` | Supply text written or approved by RBB / legal counsel | `content/policies.js` | policies | OPEN |
| D24 | **Cookies, accessibility and refund pages** | None | Decide which are required (refund/donation terms before live donations) | `content/policies.js` | policies | OPEN |
| D25 | **Donation wording** | Draft: "Secure donation", Razorpay explanation line, "How often", "Monthly — Not available online", help links | Approve or reword; decide whether "Monthly" should be shown at all | `content/donation.js` | donation | OPEN |
| D26 | **Donation currency** | Server configuration only; not set for production | Approve the currency | server env (`DONATION_CURRENCY`) | donation | OPEN |
| D27 | **Donation amounts and limits** | Server configuration only; not set for production | Approve preset amounts, minimum, maximum, and whether custom amounts are allowed | server env | donation | OPEN |
| D28 | **Designation and dedication** | Not in the donation model; not shown | Decide whether wanted. Each collects new donor data and needs its own approval | — | donation | OPEN |
| D29 | **Tax, 80G, receipt, refund, recurring wording** | None anywhere | Only with legal or tax confirmation; otherwise it stays absent | `content/donation.js`, `content/policies.js` | donation, policies | OPEN |
| D30 | **Donor emails** | Proposed wording, not approved | Approve wording, sender address and recipient inbox | `server/email`, server env | donation, email | OPEN |
| D31 | **Online donations at launch** | Page state `pending`; payments off; the form shows as a no-payment **preview** with placeholder amounts (¤), which `release:check` blocks for production | Launch with Razorpay (test, then live, verified end to end) **or** launch without online donations | `content/donation.js`, server env | donation | OPEN |
| D32 | **Image ownership and licensing** | 3 RBB-supplied field images (unconfirmed), 23 Pexels placeholders, 5 inherited legacy images (one with **unknown** source) | Confirm ownership and consent for RBB images; replace or explicitly license every other image | `docs/IMAGE_INVENTORY.md` | images | OPEN |
| D33 | **RBB field images' authenticity** | Shown as RBB's work; alt text says the volunteers wear RBB vests | Confirm they are real photographs of RBB's work, or replace them | `content/photos.js` | images | OPEN |
| D34 | **Logo files and use of the mark** | Supplied lockups; the mark is used as watermark, stamps and favicon | Confirm final files and that the mark may be used as a graphic | `src/assets/logos/` | coreIdentity | OPEN |
| D35 | **Legacy giving pages** (`/giving`, `/giving/zakat`, `/gifts`, `/giving/major-giving`) | `noindex`; inherited names ("Zakat & Sadaqah", "Charity Gifts", "Major Gifts"); only pending lines | Keep (with RBB's own content), or retire them with redirects to Donate | `content/giving.js`, `zakat.js`, `gifts.js`, `config/routes.js` | donation | OPEN |
| D36 | **SEO: production domain, share image, organization record** | No canonical, sitemap, OG image or structured data (no verified domain) | Supply the domain, an approved 1200×630 share image and the organization's logo and URL | `config/env.js` (`VITE_SITE_URL`), `content/seo.js` | infrastructure, coreIdentity | OPEN |

## Rules that hold whatever is decided

- A figure appears only with its source and status. "Pending verification" stays until the figure is approved.
- No country, project, partner, person, quote or document is published without RBB's approval and, for people, consent.
- No tax, receipt, refund, registration or security-certification claim is published without written confirmation.
- Recording a decision: update the record in `src/content/`, run `npm run validate:content`, and set the approval in `release/approvals.mjs` (status, by, date, ref).
