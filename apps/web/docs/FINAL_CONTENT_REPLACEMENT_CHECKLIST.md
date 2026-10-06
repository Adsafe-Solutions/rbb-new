# Final content replacement checklist

What Rising Beyond Borders must provide or approve, page by page, before
the site can launch. The field-level handoff list comes first; the page
sections after it give the detail. Audited on 2026-10-04 against the built site
(50 pre-rendered pages, the 404 page, 21 redirects) and every record in
`src/content/`.

**Nothing in this audit was written on RBB's behalf.** Where content is
missing, this document says so; it does not suggest wording, figures,
places or people.

Companion documents:

- `docs/RBB_CONTENT_DECISION_REGISTER.md` — the decisions only RBB can make.
- `docs/WORKING_CONTENT.md` — the sample content inventory, the working photographs and the no-visible-label rule.
- `docs/IMAGE_INVENTORY.md` — every published image, its source and licence.
- `release/approvals.mjs` — where each approval is recorded once given.

## Read this first: what "approved" means in the data

Most records in `src/content/` carry `status: "approved"` or
`"verified"`. **That does not mean RBB approved them.** Those statuses let
proposed wording render so the whole site can be reviewed (Document 27).

**2026-10-06: visible demo labels removed from sample content at the
client's request; sample records, sections and photos kept; internal
release markers keep production blocked.** Sample team profiles,
projects, stories, the homepage timeline and film, Media Center items and
appeals read as natural copy; each carries an internal, never-displayed
`releaseMarker` that the readiness scan and `release:check` still find.

RBB approval is recorded in one place only: `release/approvals.mjs`.
**All 14 approval areas there are `pending`.** The build counts every
placeholder still published — sample records by their `releaseMarker`,
working photographs by file name (`build-meta/content-readiness.json`).
The count is above 0 until RBB's content replaces the samples; launch
needs it to be 0.

## Status key

| Code | Meaning |
| --- | --- |
| **A** | Verified / approved RBB content: from RBB's own source material, wording unchanged. RBB's final confirmation is still recorded as pending. |
| **B** | Working / temporary: a sample record or working photograph. No visible demo label since 2026-10-06; an internal `releaseMarker` flags it. It must be replaced before launch. |
| **C** | Pending RBB approval: supplied by RBB, or a figure from RBB's materials, and shown with its pending status. It must not be presented as verified until approved. |
| **D** | Missing: RBB must provide it. The page shows a neutral "to be provided" line. |
| **E** | Unsupported: must not be used. Excluded from the site. |

---

## RBB handoff list — what to supply, field by field

Updated 2026-10-04. Every value below lives in a `src/content/*.js` file or
the server environment, so each one is replaced **without touching a React
component**. Edit the field, run `npm run validate:content`, record the
approval in `release/approvals.mjs`, then run `npm run release:check`.

**Handoff status words used here:**

| Status | Meaning |
| --- | --- |
| RBB INPUT REQUIRED | RBB must supply the content; nothing usable exists |
| RBB APPROVAL REQUIRED | RBB's own wording or figure is on the site; RBB must confirm it |
| BLOCKED | Waits on another decision first (named in the row) |
| TECHNICALLY READY | The site can take the value as-is; only the value is missing |
| NOT APPLICABLE | Deliberately absent; stays absent unless RBB decides otherwise |

### Organization and homepage

| Item | Route(s) | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Organization name | all | `brand.js` → `fullName`, `name` | "Rising Beyond Borders", "RBB" | Confirm | D8 | coreIdentity | RBB APPROVAL REQUIRED |
| Organization summary | footer, `/about`, metadata | `brand.js` → `summary` | Annual-report line | Confirm or replace | D8 | coreIdentity | RBB APPROVAL REQUIRED |
| Mission | `/about#mission-vision`, `/appeals` | `about.js` → `missionVision.mission.statement` | Annual-report wording | Confirm | D9 | coreIdentity | RBB APPROVAL REQUIRED |
| Vision | as above | `about.js` → `missionVision.vision.statement` | Annual-report wording | Confirm | D9 | coreIdentity | RBB APPROVAL REQUIRED |
| Homepage headline | `/` | `homepage.js` → `hero.headline` | "Building Hope. / Creating Change. / Transforming Lives." | Confirm | D8 | coreIdentity | RBB APPROVAL REQUIRED |
| Homepage supporting statement | `/` | `homepage.js` → `hero.body` | **Empty** (nothing shown) | One sentence, or confirm none | D8 | coreIdentity | RBB INPUT REQUIRED |
| Homepage section lines (approach, transparency, closing) | `/` | `homepage.js` → `approach`, `transparency`, `finalCta` | Proposed wording, no demo text | Approve or replace | D8, D11 | coreIdentity, programs | RBB APPROVAL REQUIRED |
| Logo files | all | `src/assets/logos/rbb-lockup*.png` | RBB-supplied files | Confirm final logo and its use as a graphic | D34 | coreIdentity | RBB APPROVAL REQUIRED |

### About (`/about`) and Team (`/about/team`)

| Item | Route | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Who we are, paragraph 1 | `/about#who-we-are`, `/` | `about.js` → `whoWeAre.body[0]` | Annual-report description | Confirm | D8 | coreIdentity | RBB APPROVAL REQUIRED |
| Who we are, paragraphs 2–3 | `/about#who-we-are` | `about.js` → `whoWeAre.body[1–2]` | Proposed wording, no history, place, figure or person | Confirm or rewrite | D8 | coreIdentity | RBB APPROVAL REQUIRED |
| Values (title + description each) | `/about#values` | `about.js` → `values.items` | 6 proposed values ("What guides our work") | Confirm or replace with RBB's values | D10 | coreIdentity | RBB APPROVAL REQUIRED |
| How we work | `/about#how-we-work`, `/about/how-we-work`, `/impact/our-approach` | `about.js` → `approach.intro`, `HOW_WE_WORK`; `impact.js` → `approach.intro`, `approach.principles` | Proposed wording, rewritten 2026-10-06 from wording approved elsewhere | Approve or reword | D11 | programs | RBB APPROVAL REQUIRED |
| Listen → Partner → Act → Sustain | hidden | `impact.js` → `approach.proposedFramework` (also `about.js` → `approach.steps`) | `pending-review`, not shown | Approve or reject as official framework | D11 | programs | RBB APPROVAL REQUIRED |
| Team members | `/about/team`, `/about/team/<slug>` | `team.js` → `TEAM_MEMBERS[]` (`name`, `role`, `shortBio`, `biography`, `image`, `imageAlt`, `category`, `featured`) | 6 sample profiles (a role as the name, stock portraits), each with a profile page | Real people, with consent for name, photo and bio | D16 | team | RBB INPUT REQUIRED |
| Team governance line | `/about/team` | `team.js` → `TEAM_GOVERNANCE` | Pending | Statement, or none | D16 | team | RBB INPUT REQUIRED |

### Programs, projects, impact, geography, stories

| Item | Route(s) | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 program names and one-line descriptions | `/work`, `/work/<program>`, `/` | `work.js` → `PROGRAMS[].title`, `.description` | Annual-report wording | Confirm | D12 | programs | RBB APPROVAL REQUIRED |
| Program detail (why, activities, outcomes, stories) | `/work/<program>` | `work.js` → `PROGRAMS[].why`, `.activities`, `.impact`, `.stories` | Proposed wording; no figures; links to sample stories | Final text; outcomes only with a source | D12 | programs | RBB INPUT REQUIRED |
| Program impact summaries | `/impact` | `impact.js` → `programImpact[].summary` | Proposed "working towards…" lines | Approve, replace, or none | D12 | programs | RBB APPROVAL REQUIRED |
| Measurement and evidence | `/impact` | `impact.js` → `measurement` | Proposed aims, not a system in use | RBB's approach, or none | D12 | programs | RBB APPROVAL REQUIRED |
| Projects | `/work/projects`, `/work/projects/<slug>`, `/` | `work.js` → `PROJECT_RECORDS[]` (`title`, `program`, `location`, `status`, `date`, `description`, `context`, `activities`, `impact`, `partners`, `image`, `featured`, `editorialStatus`) | 10 sample projects (no place, partner or figure) | Real projects; partners with consent | D13 | programs | RBB INPUT REQUIRED |
| 50K+ lives impacted | `/`, `/impact` | `impact.js` → `metrics[id=lives]` (`value`, `status`) | `pending-review`, stamped "Pending verification" | Verify with source, or withdraw | D1 | impact | RBB APPROVAL REQUIRED |
| 25 countries reached | `/`, `/impact` | `impact.js` → `metrics[id=countries]` | as above | Verify, or withdraw | D2 | impact | RBB APPROVAL REQUIRED |
| 200+ partners & donors | `/`, `/impact` | `impact.js` → `metrics[id=partners]` | as above | Verify, or withdraw | D3 | impact | RBB APPROVAL REQUIRED |
| "120+" | — | not in the content | Excluded | Keep off the site unless RBB defines it | D4 | impact | NOT APPLICABLE |
| Countries and regions | `/impact/where-we-work` | `impact.js` → `geography` (`summary`, `regions`, `countries`, `status`) | **Empty**; not shown | Approved list | D14 | geography | RBB INPUT REQUIRED |
| Stories | `/stories`, `/stories/<slug>`, `/`, `/impact` | `stories.js` → `STORIES[]` (`title`, `category`, `date`, `author`, `location`, `programId`, `projectId`, `excerpt`, `body`, `quotes`, `image`, `media`, `relatedStoryIds`, `featured`, `status`); `impact.js` → `stories` | 8 sample stories | Real stories; consent for people, quotes, photos | D15 | stories | RBB INPUT REQUIRED |

### Transparency and financials (`/about#transparency`)

| Item | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 78% / 12% / 10% (2026) | `transparency.js` → `financialOverview` (`items[].percentage`, `status`) | `pending-review`, stamped on every share | Verify against accounts, name the source, or withdraw | D5 | financials | RBB APPROVAL REQUIRED |
| Annual reports | `transparency.js` → `annualReports[]` (`title`, `year`, `type`, `fileUrl`, `status`) | None | Approved files | D6 | financials | RBB INPUT REQUIRED |
| Financial documents | `transparency.js` → `financialDocuments[]` | None | Approved files, or none | D6 | financials | RBB INPUT REQUIRED |
| Governance | `transparency.js` → `governance` (`intro`, `sections`, `documents`) | **Empty**; pending line | Approved statement and documents | D7 | financials | RBB INPUT REQUIRED |

### Get Involved, forms, contact

| Item | Route(s) | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Paths offered | `/get-involved/*` | `getInvolved.js` → `paths[]` | Volunteer, Fellowship, Partner, Travel With Us; proposed copy (`pending-review`), no dates, costs, destinations or eligibility | Confirm paths; content and FAQ answers per path | D20 | forms | RBB APPROVAL REQUIRED |
| Form wording and recipients | Volunteer, Partner, Travel With Us, Contact | `forms.js` (`successMessage`, `errorMessage`, `consent`); server env `EMAIL_TO_*` (incl. `EMAIL_TO_TRAVEL`), `EMAIL_FROM` | Proposed interface copy; no production recipients. Forms render (their privacy link points at `/privacy`, which shows its pending line) | Wording; one inbox per form; verified sender | D21, D30 | forms, email | RBB INPUT REQUIRED (TECHNICALLY READY) |
| Newsletter | `/stories`, `/contact` | `forms.js` → `newsletter` | Proposed consent wording | Provider and consent, or retire it | D22 | email | RBB APPROVAL REQUIRED |
| Official email | footer, `/contact` | `contact.js` → `ORG_CONTACT.methods[type=email]` | **Empty** | Real address | D17 | contact | RBB INPUT REQUIRED |
| Phone | footer, `/contact` | `contact.js` → `ORG_CONTACT.methods[type=phone]` | **Empty** | Real number, or none | D17 | contact | RBB INPUT REQUIRED |
| Address | `/contact` | `contact.js` → `ORG_CONTACT.office` | **Empty** | Real address, or none | D17 | contact | RBB INPUT REQUIRED |
| Hours, response time | `/contact` | `contact.js` → `ORG_CONTACT.hours`, `.responseTime` | **Empty** | Real values, or none | D17 | contact | RBB INPUT REQUIRED |
| Social profiles | footer, `/contact` | `contact.js` → `ORG_CONTACT.social[]` (`url`, `status`) | Platform **home pages**, not RBB accounts (TikTok `url: null`) | RBB's account URLs; remove unused platforms. A platform's own home page is never final | D18 | contact | RBB INPUT REQUIRED |
| Careers | `/about-us/careers` | `contact.js` → `CAREERS` (`sections`, `roles`) | No roles; "There are no open opportunities at the moment." | Openings, or confirm the "none at present" line | D19 | contact | RBB INPUT REQUIRED |

### Legal

| Item | Route | File → field | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Privacy policy | `/privacy` | `policies.js` → `WORKING_POLICIES.privacy` → replace with the final record (`intro`, `sections`, `effectiveDate`, `lastUpdated`) | Shows pending line; `noindex` | Text from RBB / legal counsel | D23 | policies | RBB INPUT REQUIRED (TECHNICALLY READY) |
| Terms of use | `/terms` | `policies.js` → `WORKING_POLICIES.terms` → final record | as above | as above | D23 | policies | RBB INPUT REQUIRED (TECHNICALLY READY) |
| Cookies page | none | `policies.js` → `cookies` (no route) | No cookies set by the site | Decide if a page is needed | D24 | policies | RBB APPROVAL REQUIRED |
| Donation / refund policy | none | no record yet — a new entry in `POLICY_RECORDS` with a route | None | Text from RBB / legal counsel, **only if donations go live** | D24 | policies, donation | BLOCKED on D31 |

The page template takes final legal text with no component change: a
policy whose text carries no placeholder marker renders in full and
becomes indexable once `policies` is approved (`isFinalPolicy`).

### Donation (`/appeals`)

| Item | File → field / setting | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Launch with or without online donations | `donation.js` → `status`; `donationAction.live` (link to the provider's hosted page) | `pending`; no-payment preview form | The decision | D31 | donation | RBB APPROVAL REQUIRED |
| Form wording ("Secure online giving", "How often", help links) | `donation.js` → `donationAction.checkout` | Draft | Approve or reword | D25 | donation | RBB APPROVAL REQUIRED |
| Currency | the payment provider's configuration (provider to be chosen) | Placeholder `XXX` in the preview | ISO code | D26 | donation | RBB INPUT REQUIRED |
| Preset amounts, minimum, maximum, custom amount | the payment provider's configuration (provider to be chosen) | Placeholder amounts in the preview | Approved values | D27 | donation | RBB INPUT REQUIRED |
| Ways to give | `donation.js` → `givingMethods[]` | Empty | Approved methods, or none | D31 | donation | RBB INPUT REQUIRED |
| Donation FAQs | `donation.js` → `faqs[]` | Empty | Questions **and** approved answers | D25, D29 | donation | RBB INPUT REQUIRED |
| Why give / support intro | `donation.js` → `whyGive`, `supportAreas` | Mission/vision + proposed intro | Final intro | D25 | donation | RBB APPROVAL REQUIRED |
| Designation, dedication | not in the model | Absent | Only if RBB wants them (new donor data) | D28 | donation | NOT APPLICABLE |
| Tax / 80G / receipt / refund / recurring wording | none | Absent | Only with legal / tax confirmation | D29 | donation, policies | NOT APPLICABLE |
| Donor emails | none — the templates were removed with Razorpay | Absent | Approve wording, sender, inbox once a provider is wired in | D30 | donation, email | BLOCKED on D31 |
| Payment provider | to be chosen (Razorpay was removed); `docs/DONATIONS.md` → Wiring a new provider | None integrated | The provider; test-mode verification (`paymentProviderVerified`), then live account | D31 | donation, infrastructure | BLOCKED on D31 |

### SEO and domain

| Item | Where | Now | RBB must supply | Decision | Approval area | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Production domain | build env `VITE_SITE_URL` | Not set → no canonical, sitemap, absolute URLs | The domain | D36 | infrastructure | RBB INPUT REQUIRED (TECHNICALLY READY) |
| Share image (1200×630) | `seo.js` (page images) | None | Approved image | D36 | coreIdentity, images | RBB INPUT REQUIRED |
| Organization record (structured data) | `seo.js` → `ORGANIZATION` (`status`, `logo`) | `pending`, `logo: null` | Logo file and approval | D36 | coreIdentity | RBB INPUT REQUIRED |

### Images

See section 13 for the per-image audit. RBB must confirm ownership and
consent for the 3 field images (D33) and the logo (D34), and replace or
license the other 28 (D32): 23 working `demo-*.jpg` photographs and 5
legacy images.

### Remove, don't replace (E)

Not published, and not RBB's. They should be **deleted in a clean-up**
rather than replaced. This was not done in the content phases, because
removal waits on your instruction.

| What | Why |
| --- | --- |
| `src/content/home.js`, `src/content/ngo.js`, `src/content/pages.js` | Imported by nothing. They hold another charity's sample data (appeals, figures, contacts) |
| 43 inherited images in `src/assets/` (for example `hero-gaza.jpg`, `hero-sudan.jpg`, `ngo-mosque.jpg`, `zakat-orphan.jpg`, `gifts-*.jpg` other than `gifts-hero.jpg`, `blog-*.jpg`, `vol-*.jpg`, `products-*.jpg`, `mission-*.jpg`) | Not published; inherited from the previous site; only the unused files above reference some of them |
| `src/assets/helping kids.png`, `helping old.png`, `helping-onfield.png` | **Keep**: RBB's original files, the sources of the three field photographs. Not published themselves |

### Placeholder markers — what the release gate catches

`src/lib/releaseMarkers.js` (the one marker list) detects the markers
below, plus each sample record's internal `releaseMarker` ("Sample
project", "Sample story", "Sample profile", "Sample event", "Sample
video"), which is never displayed:

- demo organization copy, the "Demo —" family, including "Demo consent —", "Demo confirmation —" and "Demo:";
- demo project copy (locations, figures, partners);
- demo story copy (author, quotations);
- demo team copy (names, "Demo profile");
- demo contact details (`example.*`, `555 01xx`, demo address);
- social links that are only a platform's home page;
- demo legal text;
- demo donation copy;
- temporary images (`demo-*`).

The build counts them, `npm run release:check` blocks on any, and the
production smoke test refuses them. **Approval is never inferred from the
markers.** A real, unmarked value still needs its area approved in
`release/approvals.mjs`.

---

## 1. Organization

| Page / item | Current state | Final RBB content required | Image required | Approval required | Status |
| --- | --- | --- | --- | --- | --- |
| Organization name "Rising Beyond Borders" | From RBB materials | Confirm name and short name "RBB" | — | coreIdentity | A |
| Organization summary ("A non-profit focused on empowering communities and creating sustainable solutions.") | From the annual report; used in the footer, metadata and About hero | Confirm or supply a final one-line description | — | coreIdentity | A |
| Mission statement | Annual report wording, unchanged | Confirm | — | coreIdentity | A |
| Vision statement | Annual report wording, unchanged | Confirm | — | coreIdentity | A |
| Logo (lockup, reversed lockup, mark) | Supplied RBB files (`src/assets/logos/`) | Confirm these are the final logo files and the mark may be used as a graphic (watermarks, stamps) | Logo files supplied | coreIdentity | C |
| Homepage headline "Building Hope. Creating Change. Transforming Lives." | From RBB's presentation and annual report | Confirm | — | coreIdentity | A |
| Homepage supporting line | Empty: the earlier demo line was removed, and the hero shows no line | Provide one sentence, or confirm none | — | coreIdentity | D |
| Registration, charity or legal status, registration number | Not shown anywhere | Provide only if RBB wants it published, with evidence | — | coreIdentity | D |

## 2. About (`/about`, one page) and Team (`/about/team`)

| Page / item | Current state | Final RBB content required | Image required | Approval required | Status |
| --- | --- | --- | --- | --- | --- |
| About hero | H1 "About Rising Beyond Borders", the summary, brand-mark panel | — (uses the organization items above) | Optional: an approved photograph | coreIdentity | A |
| 01 Who we are, paragraph 1 | Annual report description | Confirm | — | coreIdentity | A |
| 01 Who we are, paragraphs 2–3 | Proposed wording; no history, place, figure or person | Confirm or rewrite | — | coreIdentity | C |
| 02 Mission & Vision | Annual report wording | Confirm | — | coreIdentity | A |
| 03 Values (Dignity, Inclusion, Compassion, Collaboration, Accountability, Sustainability) | 6 proposed values, headed "What guides our work" | Confirm, or RBB's own values | — | coreIdentity | C |
| 04 How we work, statement and intro (and `/about/how-we-work`) | Heading "Creating change that lasts."; proposed intro; the page rewritten 2026-10-06 from wording approved elsewhere | Approved description of how RBB works | — | programs | C |
| 04 Listen → Partner → Act → Sustain | **Hidden.** Proposed in Document 02, never approved | Approve or reject it as RBB's official framework | — | programs | C (hidden) |
| 05 Transparency & Financials | See section 5, Impact & transparency | — | — | financials | — |
| Team page, 6 sample profiles (Executive Director, Head of Programs, Volunteer Coordinator, Partnerships Lead, Finance Lead, Communications Lead) | Sample roles with stock portraits; no visible demo label, internal `releaseMarker` | Real team members: name, role, short bio, photograph with consent; which ones get a full profile page | One portrait per person, with consent | team | B |
| Team governance line | Pending | Approved governance statement, or none | — | team | D |

The old addresses `/about/who-we-are`, `/about/mission-vision`,
`/about/values` and `/about/transparency` permanently redirect to their
sections of `/about`. Do not recreate them as pages.

## 3. Programs

The four program areas themselves are **A**: Education, Health &
Wellbeing, Livelihoods, Community Support, with their one-line
descriptions from the annual report.

| Page | Current state | Final RBB content required | Image required | Approval required | Status |
| --- | --- | --- | --- | --- | --- |
| `/work` overview | Program names and descriptions (A); positioning line | Confirm the overview line | Optional program photography | programs | A |
| `/work/education` | "Why this matters", "What we do" proposed; no impact figures; sample stories linked | Why it matters, activities, verified outcomes (or none), real stories | Approved Education photographs | programs | C |
| `/work/health-wellbeing` | Same pattern | Same | Approved photographs | programs | C |
| `/work/livelihoods` | Same pattern | Same | Approved photographs | programs | C |
| `/work/community-support` | Same pattern | Same | Approved photographs | programs | C |

No program outcome figures are shown (the earlier demo figures were
removed). **None may be added without RBB's verified source.**

## 4. Projects

All 10 projects are **sample records (B)**, not RBB projects. Each is
published at `/work/projects/<slug>` as an editorial preview: no place,
date, partner, figure or measured result, no visible demo label, and an
internal `releaseMarker: "Sample project"`.

| Project (slug) | Program | Image | Status |
| --- | --- | --- | --- |
| community-reading-clubs (featured) | Education | demo-edu-reading-circle | B |
| classroom-supplies | Education | demo-edu-rural-classroom | B |
| teacher-mentoring | Education | demo-edu-teacher-classroom | B |
| community-health-days (featured) | Health & Wellbeing | demo-health-checkup | B |
| clean-water-points | Health & Wellbeing | demo-health-water-pump | B |
| tailoring-skills (featured) | Livelihoods | demo-live-sewing | B |
| market-traders | Livelihoods | demo-live-market | B |
| smallholder-farming | Livelihoods | demo-live-harvest | B |
| essentials-distribution | Community Support | demo-comm-packing | B |
| community-information-days | Community Support | demo-comm-gathering | B |

**For every real project RBB supplies:** title, program, location (or
none), status, date (optional), description, context, activities,
verified impact (or none), partners **with their consent** (or none), an
approved photograph, and approval to publish. Replace these records in
`content/work.js`, or set a sample to `editorialStatus: "draft"` so it
leaves the site, but **only on RBB's instruction**.

## 5. Impact and transparency

| Page / item | Current state | Final RBB content required | Image required | Approval required | Status |
| --- | --- | --- | --- | --- | --- |
| Impact figure **50K+** lives impacted | Shown with "Pending verification" on the figure and the verification sentence | Verify with a source, or withdraw | — | impact | C |
| Impact figure **25** countries reached | As above | Verify, or withdraw. It must agree with Where We Work | — | impact | C |
| Impact figure **200+** partners & donors | As above | Verify, or withdraw | — | impact | C |
| "120+" (conflicting figure in the annual report) | **Excluded** | Must not be used unless RBB defines what it counts | — | impact | E |
| Program impact summaries (`/impact`) | 4 proposed "working towards…" lines | Approved summaries, or none | — | programs | C |
| Evidence & measurement | Proposed aims, not a system in use | RBB's actual approach to measurement, or none | — | programs | C |
| `/impact/where-we-work` | No geography shown; page is `noindex` | Approved list of countries and regions actually served. **No map until then.** | Optional | geography | D |
| `/impact/our-approach` | Mission quoted (A); proposed approach intro and principles | Approved approach and principles | — | programs | C |
| Financial overview **78% / 12% / 10%** (2026) | Shown with "Pending verification" on every share | Verify against approved accounts, or withdraw. No amounts are shown | — | financials | C |
| Annual reports | None listed; "to be provided" | Approved report files (PDF), title, year | — | financials | D |
| Financial information documents | None listed | Approved files, or none | — | financials | D |
| Governance | Pending line; no sections or documents | Approved governance information and documents | — | financials | D |
| "How information is presented" | Neutral statement | Confirm | — | financials | A |

## 6. Stories

All 8 stories are **sample records (B)**, written as natural copy with no
real people, places or figures, and no visible demo label; each carries
an internal `releaseMarker`.

| Story (slug) | Category | Image | Status |
| --- | --- | --- | --- |
| learning-to-read-together (featured) | Field | demo-edu-reading-circle | B |
| a-classroom-with-enough-books | Impact | demo-edu-rural-classroom | B |
| water-close-to-home | Community | demo-health-water-pump | B |
| health-day-in-the-square | Field | demo-health-checkup | B |
| from-one-sewing-machine | Impact | demo-live-sewing | B |
| market-day | Community | demo-live-market | B |
| packing-day | News | demo-comm-packing | B |
| new-volunteer-programme | News | demo-comm-gathering | B |

**For every real story:** title, category, date, author, location (or
none), program/project links, body, quotes **with the speaker's consent**,
photographs **with consent**, related stories, and approval to publish.

Since 2026-10-04 every sample story, project and team profile is a
**preview page**: rendered in full for review, but `noindex`, with no
canonical, share image or structured data, out of the sitemap, and with a
neutral search description instead of its excerpt (`content/seo.js`). A
record becomes indexable only when its approval area is approved in
`release/approvals.mjs` **and** it carries no placeholder.

The Media Center (`content/media.js`: 6 news items, 6 blog posts, 10
events) and Appeals (`content/appeals.js`: Emergency Appeal 01/02,
Campaign 01/02) are sample content in the same way (B), illustrated with
the working photographs.

## 7. Team

See section 2. **No real team member is on the site.** Profile pages
exist only for people with a full biography; currently that is all 6
sample profiles.

## 8. Get Involved

| Page | Current state | Final RBB content required | Image required | Approval required | Status |
| --- | --- | --- | --- | --- | --- |
| `/get-involved` hub | Path names and one-liners; proposed "choose your path" notes | Confirm the four paths (Volunteer, Fellowship, Partner, Travel With Us) | Approved photograph per path | forms | C |
| `/get-involved/volunteer` | Proposed sections; inquiry form renders, with proposed messages | What volunteering involves, who can volunteer, process; FAQ answers; form fields, consent wording, recipient | Optional | forms | C |
| `/get-involved/partner` | Proposed sections; form renders | Same for partnership | Optional | forms | C |
| Fellowship, Travel With Us | Proposed descriptive copy (`pending-review`); no dates, costs, destinations or eligibility. Travel With Us has its own form (name, email, optional phone, message) | Programme details, eligibility, process; recipient for the travel form | Optional | forms | C |
| Form success and error messages | Proposed interface copy (the "Demo confirmation —" / "Demo:" wording was removed) | Approved wording for every form | — | forms | C |
| Newsletter | Proposed consent wording | Provider, consent wording, privacy basis, or retire the newsletter | — | email | C / D |

## 9. Donation (`/appeals`)

Current state: the page is in its **pending** state. **No online payment
is possible.** No payment provider is integrated (Razorpay was removed;
RBB's provider is still to be chosen). The donation form shows as a
no-payment preview, in the header's Donate popup and on `/appeals`; its
copy is `draft`.

| Item | Current state | Final RBB content required | Approval required | Status |
| --- | --- | --- | --- | --- |
| Hero, "why give", pending notice | Mission and vision (A); pending notice (A); proposed support intro | Approved introduction | donation | A / C |
| Ways to give | None approved; "to be provided" | Approved giving methods (bank transfer etc.), or none | donation | D |
| Donation FAQs | None approved | Approved questions **and answers** | donation | D |
| Form heading ("Secure online giving"; no trust line shown) | Draft copy | Approve, or reword | donation | C |
| Frequency control | "Give once" only; no Monthly option | Confirm; recurring giving is not offered | donation | C |
| Currency | Placeholder `XXX` in the preview; the real one comes with the provider | Approved currency | donation | D |
| Preset amounts, minimum and maximum | Placeholder amounts in the preview; the real ones come with the provider | Approved amounts and limits | donation | D |
| Designation, dedication | **Not in the donation model; not shown** | Only if RBB wants them; they collect new donor data | donation | D |
| Tax, 80G, receipt, refund, recurring-cancellation wording | **None anywhere on the site** | Only with legal or tax confirmation | donation, policies | E until approved |
| Donor emails | None (the templates were removed with Razorpay) | Approved email wording, sender, recipient inbox, once a provider is wired in | donation, email | D |
| Payment provider | None chosen or integrated (Razorpay removed) | The provider, verified end to end in test mode, then a live account | donation, infrastructure | D |

## 10. Contact and careers

| Item | Current state | Final RBB content required | Approval required | Status |
| --- | --- | --- | --- | --- |
| Email | **Empty** (the reserved demo value was removed) | Real general-enquiry email | contact | D |
| Phone | **Empty** | Real number, or none | contact | D |
| Address | **Empty** | Real address, or none | contact | D |
| Hours, response time | **Empty** | Real values, or none | contact | D |
| Social links (Instagram, Facebook, TikTok, LinkedIn, YouTube) | Link to each platform's **home page**, not an RBB account; X is not used | RBB's actual account URLs; remove any platform RBB does not use | contact | B |
| Contact form | Renders, with proposed messages; no production recipient | Recipient inbox, approved wording | forms, email | C |
| Careers (`/about-us/careers`) | No roles; "There are no open opportunities at the moment."; proposed sections | Real openings or confirm the "no current openings" line; how to apply; careers contact | contact | C / D |

## 11. Legal

| Page | Current state | Final RBB content required | Approval required | Status |
| --- | --- | --- | --- | --- |
| `/privacy` | Shows the pending line ("Our privacy policy is being updated…"); the working text is held back (never displayed) and the page is `noindex`. That working text is what lets the forms render their privacy link | Privacy policy written or approved by RBB / legal counsel | policies | B |
| `/terms` | Same | Terms of use from RBB / legal counsel | policies | B |
| Cookies | No page (`placeholder`, no route) | Decide whether a cookies page is needed (no cookies are set today) | policies | D |
| Accessibility statement | None | Decide whether to publish one | policies | D |
| Donation / refund policy | None | Needed before taking live donations, from RBB / legal | policies, donation | D |

## 12. SEO

Every page has a title and description (from `content/seo.js` and the
page records). **Indexing follows RBB's approvals:** a page is `index,
follow` only when the approval areas its content depends on are approved
in `release/approvals.mjs`. While all 14 are pending, every page is
`noindex`, nothing is canonical and the sitemap is empty — by design. A
production-domain build fails if a page would be indexed while still
showing placeholder content. What is **not yet possible**:

| Item | Current state | Required | Status |
| --- | --- | --- | --- |
| Canonical URLs | **Not emitted on any page**: no verified production origin | Production domain (`VITE_SITE_URL`) | D |
| sitemap.xml | Not generated, for the same reason | Production domain | D |
| Open Graph image | **None on any page** | An approved share image (1200×630), then per-page images if wanted | D |
| Structured data (Organization) | Not emitted; organization record `pending`, logo `null` | Approved name, logo, URL and social profiles | D |
| Home, About, Work, Impact, Get Involved, Donate, Contact descriptions | Factual, from approved wording | Confirm, or replace with final wording | A / C |
| 4 program page descriptions | Annual-report one-liners | Confirm | A |
| 8 story, 10 project and 6 team page titles and descriptions | Sample records; `noindex`, neutral preview description | Replaced with the real records | B |
| Privacy and Terms descriptions | Neutral preview description; pages show the pending line | Final policies | B |
| Legacy pages `/giving`, `/giving/zakat`, `/gifts`, `/giving/major-giving` | `noindex`; titles inherited ("Zakat & Sadaqah", "Charity Gifts", "Major Gifts") | Decide to keep (with RBB content) or retire with redirects | C |
| `/impact/where-we-work` | `noindex` until geography is real | Becomes indexable automatically once it is | D |

## 13. Images

33 images are published (audited 2026-10-04 against the build). Full
sources and licences: `docs/IMAGE_INVENTORY.md` and
`docs/WORKING_CONTENT.md`.

| Image | Category | Route(s) | Purpose | Ownership / licence | Approval required |
| --- | --- | --- | --- | --- | --- |
| `logos/rbb-lockup.png`, `rbb-lockup-reversed.png` | RBB-supplied | every page (header, footer) | Logo | RBB's own | Yes (D34) |
| `rbb-field-kids.jpg` | Ownership pending | `/` | Hero photograph | Supplied by RBB, **unconfirmed** | Yes (D33) |
| `rbb-field-distribution.jpg` | Ownership pending | `/`, `/contact` | Who-we-are inset, newsletter band | Supplied by RBB, **unconfirmed** | Yes (D33) |
| `rbb-field-elder.jpg` | Ownership pending | `/`, `/appeals` | Who-we-are print, closing card | Supplied by RBB, **unconfirmed** | Yes (D33) |
| 17 × `demo-edu-*`, `demo-health-*`, `demo-live-*`, `demo-comm-*` | Temporary / working (Pexels) | program, project, story, Media Center, appeal and homepage cards and detail pages | Stand-ins for RBB field photography | Pexels licence; none shows RBB | Replace (D32) |
| 6 × `demo-team-*` | Temporary / working (Pexels) | `/about/team`, 6 profile pages | Stand-in portraits; alt text says they are stock portraits | Pexels licence | Replace (D16, D32) |
| `ngo-volunteers.jpg`, `ngo-events.jpg`, `gifts-hero.jpg`, `zakat-hero.jpg` | Legacy / inherited (Pexels) | `/giving`, `/gifts`, `/giving/major-giving`, `/giving/zakat` | Legacy giving pages | Pexels licence | Replace or retire the pages (D32, D35) |
| `ngo-classroom.jpg` | Legacy / inherited, **unknown source** | `/giving/zakat` | Newsletter band | **Unknown** | Replace, or establish its source (D32) |
| 46 files in `src/assets/` | Unused | none | — | Mostly inherited | See "Remove, don't replace (E)" above |

The three field images' alt text describes what is in the frame ("a person
in a vest printed with the Rising Beyond Borders logo"). It does not claim
RBB activity until D33 is confirmed.

| Image(s) | Where | Source / licence | What RBB must do | Status |
| --- | --- | --- | --- | --- |
| `logos/rbb-lockup.png`, `rbb-lockup-reversed.png` | Header, footer | RBB-supplied logo files | Confirm final logo | C |
| `rbb-field-kids.jpg`, `rbb-field-distribution.jpg`, `rbb-field-elder.jpg` | Home hero, who-we-are, newsletter | Supplied by RBB | **Confirm ownership, and that they are photographs of RBB's work.** Their lettering looks garbled, and their alt text says the volunteers wear RBB vests | C |
| 23 × `demo-*.jpg` (17 program/story photos, 6 team portraits) | Projects, stories, programs, team, Media Center, appeals, homepage | Pexels licence; none shows RBB | Replace with RBB photography (with consent), or explicitly license and approve | B |
| `ngo-volunteers.jpg`, `ngo-events.jpg`, `gifts-hero.jpg`, `zakat-hero.jpg` | Legacy giving pages | Pexels licence, inherited from the old site | Replace, approve, or retire the pages | B |
| `ngo-classroom.jpg` | `/giving/zakat` | **Unknown source and licence** | Replace, or establish its source | E until resolved |

**Photographs RBB needs to supply** (minimum for a launch without
working photographs):

1. Hero photograph(s) of RBB's work, with consent.
2. At least one photograph per program (4).
3. One per real project, and one or more per real story.
4. One per Get Involved path (4), so the homepage stops repeating images.
5. One portrait per team member shown, with consent.
6. A 1200×630 share image for social links.

---

## How to replace content

Edit the record in place in `src/content/`: put RBB's approved words in
and drop the sample's `releaseMarker`. Then:

1. Run `npm run validate:content`. It must report no problems.
2. Run `npm run build`. The readiness count in
   `build-meta/content-readiness.json` must fall.
3. Record the approval in `release/approvals.mjs` (who, date, reference).
4. Run `npm run release:status`. It must reach `PRODUCTION-CONTENT-READY`
   before launch.
