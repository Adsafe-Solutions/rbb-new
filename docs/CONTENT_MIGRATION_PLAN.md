# Content migration plan — what is still hard-coded, and where it goes

Read-only audit, 2026-10-12, after the first production import (the 10
records: 3 impact figures, Transparency, Careers, the 5 Get Involved
pages — `rbb-content-import-10`, ledger of 15:33) and the runtime
snapshot going live. It continues `docs/CMS_COVERAGE_AUDIT.md` (the
route-by-route coverage matrix and Milestones 1–9, all delivered) and
records what remains between the website's source content
(`apps/web/src/content/*`) and the production CMS (database
`risingbeyondborders`, organization `rbb`).

Nothing here was written to production. Media is out of scope: the 26
images the website's records reference stay in `apps/web/src/assets` until
a separate media migration (focal points and captions are already carried
end to end — `docs/MEDIA_LIBRARY.md`).

## Where production stands (read-only, 2026-10-12 ~16:00 UTC)

| Collection | Records (rbb) | Status |
|---|---|---|
| `programs` | 4 | published (education r10, community-support r5, livelihoods r5, health-wellbeing r5) |
| `about_pages` | 1 | published r19 |
| `impact_pages` | 1 | published r11 |
| `transparency_pages` | 1 | **published** (imported 15:40 as a draft; approved and published by an owner since) |
| `careers_pages` | 1 | **approved** (imported; awaiting the next publish) |
| `metrics` | 3 | draft (imported; `pending-review`) |
| `get_involved_pages` | 5 | draft (imported) |
| `team_members` | 2 | published (aquib-yazdani, mohammed-maaz — CMS-only, never on the website) |
| `site_settings` | 1 | draft r2 (contact, social, features differ from the published copy) |
| `media` | 2 | ready |
| `published_snapshots` | 14 | live **v14**: about, impact, transparency, programs 4, team 2, media 1 |
| `posts`, `events`, `appeals`, `projects`, `reports`, `policies`, `general_donation_pages`, `homepages`, `announcement_bars`, `popups`, `story_strips` | 0 | empty |

The website still shows its own content wherever the snapshot carries
nothing (posts, events, appeals, projects, stories, homepage, donation
page, bar, popup, strip, policies, Get Involved until published, figures
until published).

## Section inventory

Statuses: **Managed** = already managed in the CMS and live; **Imported** =
CMS support exists and the content is in the CMS, not yet published;
**Not imported** = CMS support exists, content still only in code; **Differs**
= a production record exists and differs from the website source (never
overwritten by the importer); **No model** = missing CMS model/API/admin
support; **Decision** = sample, placeholder, or needs an RBB decision before
it can be migrated at all.

Source hash of the website content: `d6ea10ab…` (the rehearsal manifest of
15:33; 71 records: create 10, exists-differs 7, needs-decision 44, blocked
10, plus 26 media).

### Pages and page-like records

| Section | Source | CMS model / collection | Admin | Status | Notes |
|---|---|---|---|---|---|
| Homepage (`/`) | `content/homepage.js` (12 blocks: hero, imageText, programs, approach, stats, timeline, stories, video, trust, getInvolved, faq, cta) | `Homepage` → `homepages` | `/homepage` | **Decision** | Convertible; 14 fields withheld as samples: the 6 `timeline` items, the `video` block, the 7 `faq` items. Without them the page is incomplete; with them it imports samples. Decide per block (D8, D13–D15). Production has none, so an import would not conflict |
| About (`/about`) | `content/about.js` ABOUT | `About` → `about_pages` | `/about` | **Differs** | Production r19 differs in `seo`, hero, statement, mission/vision, approach, closing cta — RBB has edited it in the CMS; the CMS copy is the truth now. Reconcile by reading, never by import. Note: `/impact/our-approach` and the Team intro still read the SOURCE mission statement |
| How We Work (`/about/how-we-work`) | `content/about.js` HOW_WE_WORK (kicker, heading, body, 4 sections: starting-point, connecting, learning, openness; six principles) | — | — | **No model** | Proposal below (M-A) |
| Transparency chapter | — | `transparency_pages` | `/transparency` | **Managed** | Published 2026-10-12; figures `pending-review` (D5) |
| Transparency documents | `content/transparency.js` annualReports `[]`, financialDocuments `[]`, governance `[]` | `Report` → `reports` | `/transparency/documents` | **Decision** | Nothing to migrate: the source lists are empty (D6, D7). Content enters the CMS directly when RBB supplies files (media migration first) |
| Team (`/about/team`) | `content/team.js` 6 sample profiles | `TeamMember` → `team_members` | `/team` | **Decision** (samples) / **Managed** (2 real) | The 6 source profiles are samples (D16). Production already holds 2 real published members, which the website shows via the snapshot; the samples are already replaced on the live site. They may enter the CMS only as **templates** (a `releaseMarker`, never publishable — `docs/PUBLISHING.md` "Team templates"), created by hand with "New template" and without their stock portraits. Team groups (`leadership`, `team`) and `TEAM_COPY`/`TEAM_GOVERNANCE` are code (see "Fixed vocabularies") |
| Careers (`/about-us/careers`) | `content/contact.js` CAREERS | `careers_pages` | `/careers` | **Imported** (approved) | Goes live at the next publish; roles empty (D19) |
| Our Work (`/work`) | `content/work.js` WORK (page copy) | — | — | **No model** (page copy only) | The program cards are Managed; the hub's intro/closing copy is code. Low priority: interface copy |
| Programs (`/work/<slug>`) ×4 | `content/work.js` PROGRAMS | `Program` → `programs` | `/programs` | **Differs** | All 4 published in production and edited there (differ in description, missingNote, why, activities, impact). Source `stories` lines name SAMPLE story titles — they stay text. CMS is the truth; no import |
| Projects (`/work/projects`, 10 detail pages) | `content/work.js` PROJECT_RECORDS | `Project` → `projects` | `/projects` | **Decision** (samples) | 10 sample projects (D13). Model complete (Milestone 6). Import only real projects, when supplied |
| Impact (`/impact`) | `content/impact.js` IMPACT | `impact_pages` | `/impact` | **Differs** | Production r11 differs in intro, programImpact, teasers, cta. The page's `stories` block names the SOURCE sample stories by id (`a-classroom-with-enough-books`, `from-one-sewing-machine`); when CMS stories arrive the block must be re-pointed in the same publish |
| Impact figures | `content/impact.js` IMPACT.metrics | `Metric` → `metrics` | `/impact/figures` | **Imported** (draft) | 3 drafts, `pending-review` (D1–D3). On publish they replace the website's figures; a `stats` block names them by slug |
| Our Approach (`/impact/our-approach`) | `content/impact.js` IMPACT.approach (intro + principles), IMPACT_PAGES.approach, the SOURCE mission | — | — | **No model** | Proposal below (M-B) |
| Where We Work (`/impact/where-we-work`) | `content/impact.js` IMPACT.geography — `summary: null, regions: [], countries: [], status: placeholder` | — | — | **No model** + **Decision** | Nothing to migrate today (D14). Never sampled. Proposal below (M-C), after the list exists |
| Impact measurement, program impact, teasers | `content/impact.js` | `impact_pages` blocks | `/impact` | **Managed** | Part of the Impact page record |
| Appeals (`/appeals/emergency|campaigns/<slug>`) ×4 | `content/appeals.js` APPEAL_RECORDS | `Appeal` → `appeals` | `/appeals` | **Decision** (samples) | 4 samples; model complete (Milestone 7). Givebutter checkout ids are a separate decision (D31) |
| General donation page (`/appeals`) | `content/donation.js` | `general_donation_pages` | `/donation-page` | **Decision** | Convertible; 4 "how support helps" cards withheld as samples (`sections.5`). The page's own wording is RBB's proposed copy (D25) |
| Giving methods, legacy giving pages (`/giving`, `/giving/zakat`, `/gifts`, `/giving/major-giving`) | `content/giving.js`, `zakat.js`, `gifts.js`; DONATION.givingMethods `[]` | — | — | **Decision** + **No model** | Only pending lines today (D35). No model until RBB decides whether the pages stay |
| Stories (`/stories`, 8 detail pages) | `content/stories.js` | `Post` (type story) → `posts` | `/stories` | **Decision** (samples) | 8 samples (D15). Model complete (Milestone 5). The first CMS story publish replaces EVERY website story (STORY_SOURCE.cms) and the Impact page must be re-pointed |
| News (`/media/news`, 6) | `content/media.js` NEWS | `Post` (news) → `posts` | `/posts` | **Decision** (samples) | 6 samples. Model complete (Milestone 4) |
| Blogs (`/media/blogs`, 6) | `content/media.js` BLOGS | `Post` (blog) → `posts` | `/posts` | **Decision** (samples) | 6 samples; categories fixed (`reflections`, `field-notes`, `how-to`) |
| Events (`/media/events`, 10) | `content/media.js` EVENTS | `Event` → `events` | `/events` | **Decision** (samples) + **blocked** | 10 samples AND every one lacks the required IANA `timezone` (RBB must name it; never inferred) |
| Media Center hub copy | `content/media.js` MEDIA_PAGES | — | — | **No model** (page copy) | Interface copy |
| Get Involved hub + 4 paths | `content/getInvolved.js` | `get_involved_pages` | `/get-involved` | **Imported** (draft) | 5 drafts. Titles, routes, icons, images and forms stay the site's by design; the hub "why" is the About mission |
| Contact (`/contact`) | `content/contact.js` ORG_CONTACT, CONTACT_COPY | `site_settings.contact` | `/settings` | **Differs** | Settings draft r2 differs from the published copy in contact, social, features. Publish the settings (owner) — no import. `CONTACT_COPY` (page copy) stays code |
| Policies (`/privacy`, `/terms`, `/donation-policy`) | `content/policies.js` working text | `Policy` → `policies` | `/policies` | **Decision** (excluded by policy) | The build refuses working text in a published policy; RBB/counsel supply final text directly in the admin (D23, D24) |
| Announcement bar | `content/announcements.js` | `announcement_bars` | `/announcements` | **Decision** | 3 sample messages withheld |
| Popup | `content/announcements.js` | `popups` | `/popups` | **Decision** | Sample (`events-autumn-2026`) withheld |
| Highlights (story strip) | derived from appeals' `story` marks | `story_strips` | `/highlights` | **Decision** | Depends on CMS appeals; nothing to migrate until they exist |
| Site settings (brand, SEO description, social) | `content/brand.js`, `site.js`, `contact.js` | `site_settings` | `/settings` | **Differs** | As Contact above; `features.themeSwitcher` is stored and not drawn |

### Content inside the site that is NOT content (stays in code, by design)

Navigation and footer (`nav.js`, `footer.js`), form definitions and
interface copy (`forms.js`, `pages.js`, `FORM_COPY`, `CONTACT_COPY`,
`TEAM_COPY`, `TRANSPARENCY_COPY` chapter words, `MEDIA_PAGES`, `STORIES_PAGES`,
`APPEALS_PAGES`, `WORK`, `SITE` strings), the fixed vocabularies
(`STORY_CATEGORIES`, `BLOG_CATEGORIES`, `EVENT_GROUPS`, `APPEAL_KINDS`,
`TEAM_GROUPS`, program icons), the organization's structured-data record
(`seo.js` ORGANIZATION), photographs (`photos.js`), and the legacy modules
nothing imports any more (`home.js`, `ngo.js`). Routes and page titles derive
from `nav.js`; a CMS never creates a route. These are out of scope for
content migration unless RBB asks for an editor for one of them.

### Focal points, captions, media

Carried end to end since Milestone 2 (`docs/MEDIA_LIBRARY.md`): a media
record's focal point and caption reach the page. Nothing to migrate in this
phase: no upload, no asset record. When the media migration runs, the
rehearsal's 26 media entries (8 with focal points) are its input.

## Counts

| | Count |
|---|---|
| Website records in the rehearsal | 71 (+26 media) |
| Already in production as CMS records (programs 4, about, impact, settings) | 7 — **Differs**, never overwritten |
| Imported 2026-10-12 | 10 (3 live or approved, 8 draft as of this audit) |
| Sample records that need an RBB decision | 44 (projects 10, team 6, stories 8, news 6, blogs 6, appeals 4) + 4 pages with sample items (homepage, donation page, bar, popup) |
| Blocked on a required field | 10 events (`timezone`) — all also samples |
| Excluded by policy | 3 policies (working text) |
| No CMS model | 3 pages (How We Work, Our Approach, Where We Work) + legacy giving pages |
| Empty in source — nothing to migrate | reports (0), giving methods (0), geography |

## Existing-record conflicts

| Record | Production | Website source | Resolution |
|---|---|---|---|
| About | published r19, edited in the admin | proposed copy | CMS is the truth. Only `/impact/our-approach` and the Team page still read the source mission; fix by the M-B model, or by reading the About record's mission there |
| Impact page | published r11 | proposed copy; `stories` block → source sample stories | CMS is the truth; re-point the stories block when CMS stories exist |
| Programs ×4 | published, edited | proposed copy; `stories` lines name samples | CMS is the truth |
| Settings | draft r2 ≠ published | source contact/social | Owner publishes the settings; no import. D17/D18 still open (real contact details and account URLs) |
| Team | 2 real published | 6 samples | Already resolved on the live site; samples never imported |

## Blocked decisions (nothing can be migrated until each is made)

- **Sample content** (D8, D13–D16, D20, D25): 44 records and 4 pages' items. The importer refuses any record or field with a release marker; the admin is the place to author real replacements.
- **Event time zone** (D21-adjacent): the CMS requires an IANA zone per event.
- **Impact figures** (D1–D4) and **financial shares** (D5): imported as `pending-review`; verification is an owner's edit in the admin.
- **Policies** (D23, D24): final text only, entered directly.
- **Geography** (D14), **How We Work wording** (D11), **approach principles**: content exists only as proposed prose; a model without approved content gains nothing.
- **Givebutter campaign ids / payment provider** (D31) before any appeal or donation page is published with a checkout.

## Proposed models (reuse first; schema changes explained)

The existing architecture is: one zod contract per record type in
`packages/content-schema`; a `BlockPageService` (one record per
organization, draft → submitted → approved → published, scheduling) for
pages and ordered collections for lists; the publish copies published
records into the snapshot; `scripts/snapshot-adapter.mjs` maps them onto the
website's modules. Every proposal below is a `BlockPage` or a field on an
existing record — no new collection kind.

**M-A — How We Work page** (`/about/how-we-work`). A new block page
`HowWeWork` (`how_we_work_pages`, one per organization) is the honest fit:
kicker, heading, intro, and ordered sections `{ id, heading, body[],
items[]? }` (the same section shape as Get Involved), plus `principles[]`.
Alternative without a new collection: a `howWeWork` section inside the
About record. Rejected: it would make the About workflow gate a separate
page, and the adapter already treats About as one page. Identifiers: the
section ids `starting-point`, `connecting`, `learning`, `openness`.
Dependencies: none. Admin: `/how-we-work`, the Get Involved editor pattern.
Adapter: `HOW_WE_WORK` in `about.js`. Decision needed first: D11.

**M-B — Our Approach page** (`/impact/our-approach`). Its content is
`IMPACT.approach` (intro, principles), `IMPACT_PAGES.approach` copy and the
mission statement. Proposal: an `approach` **block on the Impact page
record** (the page already has `measurement`, `teasers`, `stories` blocks),
`{ intro, principles[], missionSource: "about" }`, with the website reading
the mission from the published About record's `missionVision` block instead
of the source. No new collection; a contract change (new block type in
`impact-registry`), the admin's Impact block editor gains it, the adapter
maps it to `IMPACT.approach`/`IMPACT_PAGES.approach`. Identifier: block id
`approach`. Dependency: About published (it is).

**M-C — Where We Work** (`/impact/where-we-work`). `IMPACT.geography`
`{ summary, regions[{ id, name, countries[] }], status }`. Proposal: a
`geography` block on the Impact page record, `{ summary, regions:
[{ id, name, countries: [string] }] }`, with the rule the website already
has: never a sample; the page is `noindex` while the list is empty. No new
collection. Decision first: D14. A map is a later, separate decision.

**M-D — Giving methods / legacy giving pages.** Only after D35 decides the
pages' future. If kept: a `GivingMethod` ordered collection (title,
description, instructions, image) is the natural shape; if retired, nothing.

**M-E — Page copy editors** (`WORK`, `MEDIA_PAGES`, `STORIES_PAGES`,
`APPEALS_PAGES`, `CONTACT_COPY`, `TEAM_COPY`): interface copy. Not
recommended as CMS records; each is a one-line change in code and carries
no RBB facts.

## Recommended implementation sequence

1. **Finish what is imported (owner, admin, no code):** approve and publish
   the 3 figures and 5 Get Involved drafts (Careers is approved; the next
   publish carries it); publish the settings draft once D17/D18 values are
   entered. Each publish is visible on the next page load (runtime
   snapshot). Verify after the first figures publish that the homepage and
   Impact `stats` blocks show the CMS figures with the pending stamp.
2. **Contact and social (D17, D18)** in `/settings`, then publish.
3. **Real content in place of samples, in the admin, in this order of
   dependency:** programs' stories lines → stories (then re-point the
   Impact `stories` block in the same publish) → projects (each may link a
   story) → news/blogs → events (with time zones) → appeals (with D31) →
   Highlights → homepage items / donation-page cards / bar / popup. Each of
   these replaces the website's whole list for that kind at its first
   publish (the presence rule), so publish a kind only when its real set is
   ready. The importer is not the tool for this: every source record is a
   sample.
4. **Policies (D23, D24):** final text entered directly; the build refuses
   anything else.
5. **New models, each only once its content decision exists:** M-B (Our
   Approach, also removes the last read of the source mission), M-A (How We
   Work), M-C (Where We Work), M-D if the giving pages stay. Each follows
   the established milestone shape: contract → API → admin → adapter →
   render test → rehearsal (the page leaves `notMapped`) → test-database
   replay → fidelity build identical to the source.
6. **Media migration** (separate phase): upload the images real records
   need, with consent and ownership recorded (D32, D33), then re-point
   `imageId`s.

What this plan does not propose: importing any sample, overwriting any
existing production record, a second source of truth for the pages RBB has
already edited in the CMS, or a redeploy for content changes — with the
runtime snapshot live, only new addresses (a story, project, profile,
appeal or post), sitemap entries and build-time page-policy changes need
`pnpm deploy:web`.
