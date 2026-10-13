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

Listed in full, with creator and link, in `docs/WORKING_CONTENT.md`. They
live in `src/assets/` beside every other image and are published by every
build — that is what lets the whole site be reviewed. They illustrate the
sample team, projects, stories, Media Center items and appeals. **None of
them is RBB's**, and every one must be replaced or explicitly licensed and
approved before release; the readiness scan flags each one ("working
placeholder photograph") and `npm run release:status` counts what is left.
All 23 are used, none is left over.

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
