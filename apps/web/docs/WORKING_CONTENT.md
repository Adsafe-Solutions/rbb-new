# Sample content — inventory and replacement guide (Document 27)

The site has ONE content source (`src/content/`) and ONE image set
(`src/assets/`). `npm run dev` and `npm run build` show the same complete
website. There is no staging content mode, no `src/content/demo/` and no
`VITE_CONTENT_MODE`.

Much of the content is SAMPLE content, kept so every section of the site
is populated and can be reviewed, tested and shown while Rising Beyond
Borders' own words, people and photographs are prepared.

**2026-10-06: visible demo labels removed from sample content at the
client's request; sample records, sections and photos kept; internal
release markers keep production blocked.**

## The rule

- **Sections stay populated.** Sample records stay in place until RBB's
  own content replaces them.
- **Visible text never labels itself as demo.** No "Demo text —",
  "(demo)", "Demo Community Hall", "Sample profile", "Demo Author" or the
  like on any page. Sample records are written as natural NGO copy, and
  invent no real people, places or figures.
- **Every sample record carries an internal `releaseMarker`.** It is
  never displayed: a component renders it only as a hidden
  `data-release-marker` / `hidden` element. The readiness scan
  (`scripts/production-gate.mjs` → `build-meta/content-readiness.json`)
  and `npm run release:check` find it, so a production release stays
  blocked until RBB replaces the record. Write new samples the same way.
- **The readiness count is above 0, and that is expected** until RBB's
  content replaces the samples. The working photographs are flagged by
  file name in the same scan.

## What is NOT given a sample

A bald fact or a file cannot be made safe by a hidden marker. These stay
empty or `pending-review`, and only RBB can fill them:

- **Impact figures** (50K+, 25, 200+) — `pending-review`, shown with the
  verification note. The inconsistent "120+" is excluded entirely.
- **Financial overview** (2026 78 / 12 / 10) — `pending-review`.
- **Documents** — annual reports, financial summaries, governance
  frameworks. No document is listed without a real, approved file: a
  report link is a file someone downloads.
- **Contact details, careers roles, geography** — empty since the
  2026-10-04 content brief; nothing unverified is shown.
- **The proposed Listen → Partner → Act → Sustain framework** —
  `pending-review`; it is never presented as RBB's methodology.
- **Mission and vision** — the annual report's own wording, unchanged.
- **Donation state** — the page stays `pending`. Giving is real money, so
  no sample turns a checkout on (`docs/DONATIONS.md`).

## Where sample content is, area by area

| Area | Sample content | File |
| --- | --- | --- |
| Team | 6 sample profiles: a role as the name (e.g. "Executive Director"), a short bio, a stock portrait; each has its own `/about/team/<slug>` page | `content/team.js` |
| Projects | 10 sample projects across the 4 programs, each with a working photograph | `content/work.js` |
| Stories | 8 sample stories (2 per category), galleries, related stories | `content/stories.js` |
| Homepage timeline | 6 sample events, each with a stand-in NASA Short and a working-photo poster | `content/homepage.js` → `timeline.events` |
| Homepage film | A stand-in film (`video.youtubeId`) with a working-photo poster | `content/homepage.js` → `video` |
| Media Center | 6 news items, 6 blog posts, 10 events (`/media`, `/media/news`, `/media/blogs`, `/media/events` and each item's page) | `content/media.js` |
| Appeals | 4 sample appeals: Emergency Appeal 01/02, Campaign 01/02 | `content/appeals.js` |
| Policies | Working Privacy and Terms text. **Never displayed** — the policy pages show their pending line and are `noindex` — but its presence is what lets the forms render their privacy link | `content/policies.js` |
| Social links | Links to each platform's home page, never an account (flagged as "platform home page as social link") | `content/contact.js` |

The homepage hides its timeline, stories and film sections only when they
are empty; while the samples exist they show. The Media Center, appeals
and team lists have empty-state copy for the same reason; it is not shown
while sample records exist.

## Proposed copy — real wording, not samples

Fellowship and Travel With Us (`content/getInvolved.js`, with a Travel
With Us register-interest form, `formId` `travel`), How We Work
(`/about/how-we-work`, `content/about.js` → `HOW_WE_WORK`, written from
approved wording), and the form success, error and consent messages
(`content/forms.js`) carry no demo text. They are proposed wording and
stay `pending-review` until RBB approves them.

## Working photographs (Pexels)

All are free under the [Pexels licence](https://www.pexels.com/license/).
None shows RBB's work, people or places, so the alt text describes only
what is in the frame. The same photographs also illustrate the sample
homepage timeline and film poster, Media Center items and appeals
(`WORKING_PHOTOS` in `content/photos.js`). The readiness scan flags every
one by its file name ("working placeholder photograph"). **Replace every one, or license and approve it
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
| demo-team-1.jpg | [29852895](https://www.pexels.com/photo/29852895/) | Ifeyinka Adeyemo | Sample team portrait |
| demo-team-2.jpg | [18809829](https://www.pexels.com/photo/18809829/) | Audy of Course | Sample team portrait |
| demo-team-3.jpg | [30767572](https://www.pexels.com/photo/30767572/) | Uiliam Nörnberg | Sample team portrait |
| demo-team-4.jpg | [34381970](https://www.pexels.com/photo/34381970/) | Zoe Galarza | Sample team portrait |
| demo-team-5.jpg | [12437056](https://www.pexels.com/photo/12437056/) | Lubomir Satko | Sample team portrait |
| demo-team-6.jpg | [30004322](https://www.pexels.com/photo/30004322/) | Daniel & Hannah Snipes | Sample team portrait |

The team portraits (`TEAM_PORTRAITS`) are stock photographs of real
models standing in for sample roles. Their alt text says they are stock
portraits, not members of RBB. Do not use them for real staff.

RBB's own three field photographs (`rbb-field-*.jpg`) are NOT
placeholders; see `docs/IMAGE_INVENTORY.md` for every published image,
its source and its licence basis.

## How the build treats all of this

Two scans of the output, with two different jobs
(`scripts/production-gate.mjs`):

- **Safety gate** — credentials, forbidden files, development routes.
  FAILS the build, always, in every environment.
- **Readiness scan** — where sample records (their `releaseMarker`s),
  working photographs and stand-in social links are still published.
  NEVER fails a build; it writes `build-meta/content-readiness.json` and
  blocks `PRODUCTION-CONTENT-READY` in `npm run release:status`.

`npm run smoke -- --expect=production` also refuses a page carrying a
placeholder; any other `--expect` only refuses credentials.

## RBB replacement checklist

Replacing a sample means editing the record in place: put RBB's approved
words in and drop its `releaseMarker`. Nothing has to be moved between
files.

- [ ] Verify mission, vision and values; approve the proposed copy.
- [ ] Verify the impact figures and the financial overview.
- [ ] Replace the sample team with approved people, with consent (`content/team.js`).
- [ ] Replace projects; supply countries and regions (`content/work.js`, `content/impact.js`).
- [ ] Replace stories, with consent (`content/stories.js`).
- [ ] Replace news, blogs, events and appeals (`content/media.js`, `content/appeals.js`).
- [ ] Replace the homepage timeline and film, or empty them to hide the sections (`content/homepage.js`).
- [ ] Supply contact details, social accounts and careers (`content/contact.js`).
- [ ] Replace photographs and confirm licences (`docs/IMAGE_INVENTORY.md`).
- [ ] Publish approved Privacy and Terms text; decide on a Cookies page.
- [ ] Add the real reports, financial documents and governance material (`content/transparency.js`).
- [ ] Approve donation amounts, currency, fields and copy; choose a payment provider, wire it in and verify it in test mode, then live (`docs/DONATIONS.md`).
- [ ] Configure Resend: production domain, From address and recipients (`docs/FORMS_AND_EMAIL.md`).
- [ ] Configure analytics only if approved.
- [ ] Select the host; audit its cookies and scripts.
- [ ] Run `npm run build && npm run release:status` — the readiness scan must report 0 placeholders before a production release.
