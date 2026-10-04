# Working placeholder content — inventory and replacement guide (Document 27)

The site has ONE content source (`src/content/`) and ONE image set
(`src/assets/`). `npm run dev` and `npm run build` show the same complete
website. There is no staging content mode, no `src/content/demo/` and no
`VITE_CONTENT_MODE`.

Much of the content is still a WORKING PLACEHOLDER, kept so the whole site
can be reviewed, tested and shown while Rising Beyond Borders' own words
are written. **Every placeholder says so on its face**, so nothing
invented here can be read as RBB's:

| Kind | How it labels itself |
| --- | --- |
| Page text | opens `Demo text — …`, `Demo — …`, `Demo summary — …`, `WORKING text — …` |
| Team profiles | fictional names ("Amara Demo"), role suffix `· Demo profile`, and a biography whose first line says the person is fictional |
| Stories | a first paragraph saying the people, places and details are invented; quotations attributed `(demo quotation)`; `Demo Author` |
| Projects | locations like `South Asia · demo`, impact lines marked `(demo figure)`, `Demo Partner — …` |
| Geography | region and country names ending `(demo)` / `Demo country A–F` |
| Policies | each opens `Demo text — this is NOT Rising Beyond Borders\' policy…` |
| Contact | reserved, unreachable values: `hello@example.org` (RFC 2606) and `+1 555 0100`; `100 Demo Street, Demo City, Demo Country`; social links to each platform\'s HOME PAGE, never an account |
| Careers | roles marked `(demo role)` |
| Photographs | filenames `demo-*.jpg`; team portraits carry the alt text "Stock portrait used as a placeholder — not a member of Rising Beyond Borders" |

## What is NOT given a placeholder

A self-label cannot rescue a bald fact or a file. These stay exactly as
they were before any placeholder existed, and only RBB can fill them:

- **Impact figures** (50K+, 25, 200+) — `pending-review`, shown with the
  verification note. The inconsistent "120+" is excluded entirely.
- **Financial overview** (2026 78 / 12 / 10) — `pending-review`.
- **Documents** — annual reports, financial summaries, governance
  frameworks. No document is listed without a real, approved file: a
  report link is a file someone downloads.
- **The proposed Listen → Partner → Act → Sustain framework** —
  `pending-review`; it is never presented as RBB\'s methodology.
- **Mission and vision** — the annual report\'s own wording, unchanged.
- **Donation state** — the page stays `pending`. Giving is real money, so
  no working placeholder turns the checkout on (Document 22).

## Where placeholders are, page by page

| Area | Working placeholder content | File |
| --- | --- | --- |
| Home | Hero line, approach intro, transparency line, closing line; featured projects and stories come from the records below | `content/homepage.js` |
| About | Second "who we are" paragraph, 4 values, approach intro and steps, transparency line | `content/about.js` |
| Team | 6 fictional people with stock portraits; governance line | `content/team.js` |
| Our Work | Why / what / impact / stories for all 4 programs; 10 projects with demo locations, figures and partners | `content/work.js` |
| Impact | Program summaries, geography (4 regions, "Demo country A–F"), approach, principles, measurement | `content/impact.js` |
| Stories | 8 stories (2 per category), galleries, related stories | `content/stories.js` |
| Get Involved | Volunteer, Partner and Fundraise sections, lists and FAQs; the "choose your path" notes | `content/getInvolved.js` |
| Donate | Support intro and transparency line only — the page state, ways to give and FAQs are NOT placeholders | `content/donation.js` |
| Contact · Careers | Email, phone, address, hours, response time, social links, careers sections and 3 roles | `content/contact.js` |
| Transparency | Governance intro and sections (no documents) | `content/transparency.js` |
| Policies | Privacy and Terms page text | `content/policies.js` |
| Forms | Success / error messages and the newsletter consent wording | `content/forms.js` |

## Temporary photographs (Pexels)

All are free under the [Pexels licence](https://www.pexels.com/license/).
None shows RBB\'s work, people or places, so the alt text describes only
what is in the frame. **Replace every one, or license and approve it
explicitly, before launch.** WebP copies are generated for all of them by
`npx -p playwright node scripts/responsive-images.mjs` (one image set, no
`--demo` flag any more).

| File (`src/assets/`) | Pexels photo | Photographer | Used for |
| --- | --- | --- | --- |
| demo-edu-rural-classroom.jpg | [15119089](https://www.pexels.com/photo/15119089/) | Pallav Suthar | Classroom Supplies project; story |
| demo-edu-teacher-classroom.jpg | [18395403](https://www.pexels.com/photo/18395403/) | C.T. PHAT | Teacher Mentoring project; gallery |
| demo-edu-girl-reading.jpg | [12926472](https://www.pexels.com/photo/12926472/) | Photomandi PK | Story gallery |
| demo-edu-reading-circle.jpg | [8613089](https://www.pexels.com/photo/8613089/) | Yan Krukau | Reading Clubs project; featured story |
| demo-health-checkup.jpg | [5327584](https://www.pexels.com/photo/5327584/) | Thirdman | Health Days project; story |
| demo-health-team.jpg | [6129657](https://www.pexels.com/photo/6129657/) | RDNE Stock project | Story gallery |
| demo-health-water-pump.jpg | [28101466](https://www.pexels.com/photo/28101466/) | illustrate Digital Ug | Water Points project; story |
| demo-health-drinking-water.jpg | [28101461](https://www.pexels.com/photo/28101461/) | illustrate Digital Ug (confirmed 2026-09-24) | Story gallery |
| demo-live-vegetable-seller.jpg | [10146963](https://www.pexels.com/photo/10146963/) | Rohan Dewangan | Story gallery |
| demo-live-market.jpg | [20432829](https://www.pexels.com/photo/20432829/) | Fireworks Uche | Market Traders project; story |
| demo-live-sewing.jpg | [3738100](https://www.pexels.com/photo/3738100/) | cottonbro studio | Tailoring project; story |
| demo-live-harvest.jpg | [10745258](https://www.pexels.com/photo/10745258/) | Leonardo Vazquez | Smallholder project; gallery |
| demo-comm-gathering.jpg | [31874011](https://www.pexels.com/photo/31874011/) | Helena Jankovičová Kováčová | Information Days project; story |
| demo-comm-aid-boxes.jpg | [6647178](https://www.pexels.com/photo/6647178/) | RDNE Stock project | Story gallery |
| demo-comm-packing.jpg | [7156178](https://www.pexels.com/photo/7156178/) | Gustavo Fring | Essentials project; story |
| demo-comm-food-prep.jpg | [6995212](https://www.pexels.com/photo/6995212/) | Julia M Cameron | Story gallery |
| demo-comm-relief-packing.jpg | [6646871](https://www.pexels.com/photo/6646871/) | RDNE Stock project | Story gallery |
| demo-team-1.jpg | [29852895](https://www.pexels.com/photo/29852895/) | Ifeyinka Adeyemo | Demo portrait |
| demo-team-2.jpg | [18809829](https://www.pexels.com/photo/18809829/) | Audy of Course | Demo portrait |
| demo-team-3.jpg | [30767572](https://www.pexels.com/photo/30767572/) | Uiliam Nörnberg | Demo portrait |
| demo-team-4.jpg | [34381970](https://www.pexels.com/photo/34381970/) | Zoe Galarza | Demo portrait |
| demo-team-5.jpg | [12437056](https://www.pexels.com/photo/12437056/) | Lubomir Satko | Demo portrait |
| demo-team-6.jpg | [30004322](https://www.pexels.com/photo/30004322/) | Daniel & Hannah Snipes | Demo portrait |

The team portraits are stock photographs of real models standing in for
fictional people. Their alt text says so. Do not use them for real staff.

RBB\'s own three field photographs (`rbb-field-*.jpg`) are NOT
placeholders; see `docs/IMAGE_INVENTORY.md` for every published image,
its source and its licence basis.

## How the build treats all of this

Two scans of the output, with two different jobs
(`scripts/production-gate.mjs`):

- **Safety gate** — credentials, forbidden files, development routes.
  FAILS the build, always, in every environment.
- **Readiness scan** — where working placeholders are still published.
  NEVER fails a build; it writes `build-meta/content-readiness.json` and
  blocks `PRODUCTION-CONTENT-READY` in `npm run release:status`.

`npm run smoke -- --expect=production` also refuses a page carrying a
placeholder; any other `--expect` only refuses credentials.

## RBB replacement checklist

Replacing a placeholder means editing the record in place: drop the
self-labelling, put RBB\'s approved words in. Nothing has to be moved
between files.

- [ ] Replace the placeholder text; verify mission, vision and values.
- [ ] Verify the impact figures and the financial overview.
- [ ] Replace the placeholder team with approved people, with consent (`content/team.js`).
- [ ] Replace projects and countries (`content/work.js`, `content/impact.js`).
- [ ] Replace stories (`content/stories.js`).
- [ ] Replace contact details, social accounts and careers (`content/contact.js`).
- [ ] Replace photographs and confirm licences (`docs/IMAGE_INVENTORY.md`).
- [ ] Publish approved Privacy and Terms text; decide on a Cookies page.
- [ ] Add the real reports, financial documents and governance material (`content/transparency.js`).
- [ ] Approve donation amounts, currency, fields and copy; configure Razorpay test, then live (`docs/DONATIONS.md`).
- [ ] Configure Resend: production domain, From address and recipients (`docs/FORMS_AND_EMAIL.md`).
- [ ] Configure analytics only if approved.
- [ ] Select the host; audit its cookies and scripts.
- [ ] Run `npm run build && npm run release:status` — the readiness scan must report 0 placeholders.
