# Image inventory — Document 24 §14

Every photograph the site publishes, where it comes from and on what basis
it is used. **RBB must approve ownership, licence or permission for each
before release** (`release/approvals.mjs` → `images`). Last checked
2026-09-24 against the build (`npm run build`). One content source, one
image set (Document 27).

No RBB-approved replacement photography has been supplied yet, so nothing
has been replaced.

## RBB's own and inherited images — 8 source images

| File (`src/assets/`) | Shown on | Source | Licence / basis | Creator | Status |
| --- | --- | --- | --- | --- | --- |
| rbb-field-kids.jpg | `/` (hero; who-we-are collage; Donate tab) | Supplied by RBB ("helping kids.png") | RBB's own branded image | RBB (to confirm) | **RBB to confirm** ownership and approve it as a photograph of its work. It reads as illustrative, and the lettering is garbled (Documents 02/03) |
| rbb-field-distribution.jpg | `/` (collage; Volunteer and Fundraise tabs) | Supplied by RBB ("helping-onfield.png") | RBB's own branded image | RBB (to confirm) | As above |
| rbb-field-elder.jpg | `/` (collage; Partner tab; closing card), `/appeals` (closing band) | Supplied by RBB ("helping old.png") | RBB's own branded image | RBB (to confirm) | As above |
| ngo-volunteers.jpg | none — `/giving` retired (D35); only the unused sample modules `content/ngo.js`, `pages.js` import it | Pexels [6646918](https://www.pexels.com/photo/6646918/) | Pexels licence | RDNE Stock project | Inherited from the old site. Replace, or approve under the Pexels licence |
| ngo-events.jpg | none — those pages retired (D35); only the unused sample modules import it | Pexels [13418669](https://www.pexels.com/photo/13418669/) | Pexels licence | Quyn Phạm (checked) | Inherited. Replace or approve |
| gifts-hero.jpg | none — `/gifts` retired (D35); only the unused `content/ngo.js` imports it | Pexels [35106287](https://www.pexels.com/photo/35106287/) | Pexels licence | Dauphotographer | Inherited. Replace or approve |
| zakat-hero.jpg | none — `/giving/zakat` retired (D35); still listed in `scripts/responsive-images.mjs` | Pexels [7345444](https://www.pexels.com/photo/7345444/) | Pexels licence | Shkraba Anthony | Inherited. Replace or approve |
| ngo-classroom.jpg | none — `/giving/zakat` retired (D35); only the unused `content/pages.js` imports it | **Unknown** — arrived with the initial import, no credit recorded | **Unknown** | Unknown | **Replace, or establish its source**, before release |

Each has WebP copies in `src/assets/responsive/`.

**The homepage repeats these three photographs.** Since the design
catalogue sections were promoted (collage, tabbed Get Involved, closing
card), each photograph appears two or three times. They are the only
approved images. RBB supplying more field photography, ideally one per
Get Involved path, removes the repetition. The four legacy giving
pages, which only pointed visitors to Donate, were retired (D35,
2026-10-13); their five inherited images are no longer shown.

The Pexels licence allows free use with no attribution required. Recording
the creator is good practice, and it is how a photograph can be traced if
questioned. It does not grant model or property releases. For images of
identifiable people used for fundraising, RBB should decide whether that is
acceptable.

## Working placeholder photographs — 23 temporary Pexels images

Listed in full, with creator and link, below. They live in `src/assets/`
beside every other image (`WORKING_PHOTOS` / `TEAM_PORTRAITS` in
`content/photos.js`). The "Used for" column is what each illustrated when
the website held its own sample content; since 2026-10-13 that content is
the CMS's, and a page frame may still use one. **None of
them is RBB's**, and every one must be replaced or explicitly licensed and
approved before release; the readiness scan flags each one ("working
placeholder photograph") and `npm run release:status` counts what is left.
All 23 are still in the site's image set (`content/photos.js`).

All are free under the [Pexels licence](https://www.pexels.com/license/).
None shows RBB's work, people or places, so the alt text describes only
what is in the frame.

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


**Resolved flag:** `demo-health-drinking-water.jpg` (Pexels
[28101461](https://www.pexels.com/photo/28101461/), "Girl Drinking Water
from the Pipe") is by **illustrate Digital Ug**. This was confirmed on the
photo's Pexels page on 2026-09-24.

## Not published — files in the repository that no page uses

`src/assets/` still holds images from the site this replaced. Examples are
`hero-gaza.jpg`, `hero-sudan.jpg`, `ngo-sudan.jpg`, `ngo-mosque.jpg` and
`gifts-*.jpg` other than the hero. Some are imported by legacy data
(`content/home.js`, `content/ngo.js`) or the dev-only component catalogue.
**None reaches a production page**, which the build output confirms: only
the 8 images above and the 23 working photographs are emitted. They were
not deleted in this phase. RBB or the developer may remove them in a
clean-up. They must never return to a public page (Document 01).

## When an image is replaced

1. Put the approved file in `src/assets/` and point the content record at it.
2. Write alt text that describes what is in the frame.
3. Add it to `APPROVED_SOURCES` in `scripts/responsive-images.mjs`, then run
   `npx -p playwright node scripts/responsive-images.mjs` to make the WebP
   copies.
4. Update this table with source, licence or permission, creator, and any
   attribution required.
