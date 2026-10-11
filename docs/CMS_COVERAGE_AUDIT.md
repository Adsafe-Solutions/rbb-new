# CMS coverage and schema-gap audit

Status: read-only audit of the current code (2026-10-11). Nothing here was
implemented. Paths: `ADP` = `apps/web/scripts/snapshot-adapter.mjs`, `PUB` =
`apps/api/src/modules/publishing/service.ts`, `SNAP` =
`packages/content-schema/src/snapshot/snapshot.ts`, `PG` =
`apps/api/src/modules/pages/service.ts`.

## How to read coverage

A field is **covered** only when all five layers hold it: the content schema,
the API's accepted input, an admin editor, the published snapshot (PUB copies
stored records as they are, minus timestamps — PUB:127), and the web adapter
that maps the snapshot into the site (ADP). A page rendering identically is
**not** evidence of coverage: the fidelity build (below) only exercised the 12
records the writer could migrate, and a field the source never sets cannot
show a difference.

Rules that apply everywhere:
- API input is strict: collections accept only their `editable` list
  (`content/service.ts:86-91`), pages only `sections`/`seo` or their typed
  `parts` (PG:144-148). Anything else — `releaseMarker` included — is refused.
- **Release markers are UNSUPPORTED in the CMS on every record type**, by
  design: refused at save (PG:279-284, strict editable lists), stripped from
  settings (PUB:534), refused by the snapshot (SNAP:227-486).
- **Image focal points are UNSUPPORTED end to end**: in the `Media` schema
  (`media/media.ts:25`) but nowhere in the API media record, the admin,
  `PublishedMedia` (SNAP:139-146), the publish copy (PUB:559) or `imageOf`
  (ADP:155-158). CMS images always render centred.
- **Image captions are UNSUPPORTED**: the API stores and the admin edits a
  caption, but the schema, snapshot and adapter drop it; StoryDetail renders
  `image.caption` / `media[].caption`, which nothing supplies.

## Route coverage matrix

Legend — Source: **CMS** (a published snapshot replaces it) · **code** · **mixed**.
"Editor" = an admin screen edits it. "Carried" = schema + API + snapshot + adapter.

| Route | Content | Source | Editor | Carried | Gaps and dependencies |
|---|---|---|---|---|---|
| `/` homepage | 15 block types (hero, imageText, programs, approach, stats, timeline, stories, video, trust, getInvolved, faq, cta, appealList, postList, eventList), SEO | CMS once published, else all code (`homepage.js`) | yes (`homepage/BlockEditor.tsx`) | mostly | Dropped by ADP: programs/getInvolved `body`+`cta` and getInvolved `imageIds` (ADP:285, 293); timeline/stories `body` (289-290); cta `imageId`/`cardImageId` (295); approach/appealList `highlight` not rendered. Code: hero kicker (= brand name), slideshow/play labels, approach steps, Get Involved cards. Refs: stats → metric slugs; timeline → program slugs; lists → published appeals/posts/events. Sample: timeline (6), film, FAQ (7) carry markers. `featuredWork` is never rendered |
| `/about` (+ 4 anchor forwards) | pageHero, statement, missionVision, numberedCards, approach, transparency placement, cta, SEO | CMS (**published in production**) | yes | mostly | Dropped: statement `cta`, numberedCards `intro`, missionVision `highlight` (ADP:333-335); approach `highlight` not rendered. Forwards land on fixed anchors (`nav.js:66-73`). The mission is still read from SOURCE by `/impact/our-approach` and the Team intro (`team.js:209`) |
| `/about/how-we-work` | practices, rows, teasers | code | no | no | No CMS model |
| `/about/team`, profiles | members (name, role, group, order, bio, biography, photo, links) | CMS (**1 real member published**) | yes | yes | `featured` stored, never rendered. Page copy/groups/governance are code. 6 samples carry markers. **A single team record of any status (even draft/archived) replaces the whole list** (PUB:389, 419) |
| `/work`, `/work/<program>` | program index, program pages, menu, homepage cards | CMS (**4 published in production**) | yes | yes | All `WORK` copy is code (incl. "four areas" wording). Program `stories` lines are unmarked SAMPLE story titles |
| `/work/projects`, detail | projects | CMS once one is published | yes | partly | Template draws location, stage, date, impact, partners, linked story — **no schema**. Admin help text wrongly says featured projects show on the homepage. 10 samples carry markers |
| `/impact` | intro, stats, programImpact, teasers, measurement, stories, trust, cta, SEO | CMS (**published in production**) | yes | yes | Stories block names story **ids**: website ids pass while the CMS has no stories (`content/shared.ts:127`); once CMS stories are carried every named id must be published (SNAP:405) and the build throws on a missing one (`CmsImpact.jsx:49-60`). `STAT_ICONS` keyed to the website's figure ids |
| `/impact/our-approach`, `/impact/where-we-work` | approach, principles, geography | code | no | no | No CMS model (geography must never be a sample) |
| Impact figures | value, label, verification | CMS once one is published | yes | yes | Icon has no field. Verification preserves `pending-review` |
| Transparency (in `/about`) | chapter words, financial overview, governance, accountability, documents | CMS once published | yes | mostly | Governance/accountability published as `verified` whenever present (ADP:784-785) — not rendered today. Sub-section copy is code |
| `/stories`, detail | stories (one source at a time, `STORY_SOURCE`) | CMS once one is published, replacing ALL website stories | yes | partly | No `quotes`/`impact` in schema; captions/focal lost; `seo.noIndex` not editable. First publish needs: approved story, valid category, ≤1 featured, described images, related stories/projects/programs published, and the Impact page re-pointed to CMS story ids |
| `/blogs`, `/blogs/:slug` | redirects to `/stories` | code | — | — | CMS blogs live at `/media/blogs/:slug`; old blog links land on a story slug |
| `/media/news`, `/media/blogs`, details | posts | CMS | yes | partly | API/admin lack news `programId` and blog `category` (`posts/service.ts:15`) though schema and adapter have them. `ogImageId`/`noIndex` dropped (ADP:161) |
| `/media/events`, detail | events | CMS | yes | partly | API/admin lack `programId`, `schedule` (defaults `null`/`[]`, `events/service.ts:31`); API **requires** `timezone` the source never has |
| `/appeals`, kinds, detail | appeals; kind pages; trust | CMS (appeals) + code (kinds, hub copy) | yes | partly | Hard-coded "Support …" title, "Why this … matters" heading and kicker override CMS statements (`donation.js:460-481`); admin always saves `richText`; statement `cta`/`highlight`, numberedCards `kicker`/`highlight` dropped; `startsOn`/`endsOn`, `designation`, `formOverrides`, `ogImageId`, `noIndex` stored but not used |
| General donation page | hero, why, impact, trust, FAQ, closing | mixed | yes | partly | API refuses `faq`, `trust`, `appealList` (and `imageText`, `stats`) sections (`appeals/service.ts:30-44`): **donation FAQs have no CMS path**. "Why give" kicker hard-coded (ADP:215). `settings.donations` never applied (ADP:123) |
| Giving methods, legacy `/giving*`, `/gifts` | — | code | no | no | No CMS model |
| `/get-involved`, 4 paths | hub text, path sections, FAQ, notes | CMS by page | yes | yes | Path identity (title, icon, images, form, CTA label) and hub related/questions are code by design. No importer in the rehearsal. Hub has no SEO field. Forms: API takes contact/volunteer/partner/fundraise only; travel form config exists but is refused; fellowship has no form |
| `/about-us/careers` | full page | CMS once published | yes | yes | `seo.noIndex` read but not editable |
| `/contact` | contact methods, office, hours, social | CMS (settings) | yes | yes | Contact method `description` rendered but not editable; `generalInquiry` and page copy are code; source social links are platform root URLs |
| `/privacy`, `/terms`, `/donation-policy` | policy text, dates | CMS by id, else code working text | yes | yes | Source text is working placeholder text. **The API accepts working text; only the web build refuses it (ADP:529)** |
| Announcement bar, popup, Highlights | messages; popup; strip order | CMS | yes | yes | Control labels are code; popup `includePaths`/dates refused. Source items and popup carry markers |
| Settings | general, contact, social, seo, branding, analytics, donations, engagement, features | CMS (**draft r2 in production; published copies in v1-v4**) | 8 of 9 (no `features` editor) | partly | Not applied by ADP: `seo.ogImageId` (no default share image anywhere), `branding`, `analytics`, `donations`, `features` (ADP:117-127) |
| Header, footer, nav, 404, newsletter | — | code | no | — | Our Work menu follows CMS programs; legal links follow published policies; brand line follows settings. Newsletter form is a draft and the API refuses it |

### Sharing metadata

| Type | title / description / image editable | noIndex editable | Carried and rendered |
|---|---|---|---|
| Homepage, About, Impact, programs, projects, stories | yes | **no (no admin field anywhere)** | all four carried and honoured |
| News, blogs, events, appeals, donation page | yes | no | **title and description only**; `ogImageId`, `noIndex` dropped (ADP:161, 254, 273) |
| Careers | title, description (schema has no image) | no | yes |
| Get Involved paths / policies | description | — | yes |
| Get Involved hub, team members | no field (team uses the photo) | — | — |
| Settings `seo.ogImageId` | yes | — | **never rendered** |

### Links

Label and href are preserved for every link the adapter maps (`linkOf`,
ADP:281). Dropped: homepage programs/getInvolved `cta`, About statement `cta`,
appeal/donation statement `cta`. **Unverified risk:** every CMS link becomes a
`<Button to>` → react-router `Link` (`Button.jsx:126-128`); the schema allows
`https:`, `mailto:`, `tel:` and `#` hrefs, and no test proves they render as
plain links.

## Reconciliation with the migration manifest and fidelity run

The current source hash equals the one the M52 writer used (`293b3d82…`), so
those results still describe today's source.

| Manifest finding (offline, 66 records, 26 media) | Matrix |
|---|---|
| 12 eligible: 4 programs, 3 figures, settings, About, Impact, Transparency, Careers | Agrees. All carried; caveats: program `stories` lines are sample titles; Transparency status flags; `noIndex` not editable |
| 50 records with release markers (projects 10, team 6, stories 8, news 6, blogs 6, events 10, appeals 4) + 4 pages with markers (homepage, donation, bar, popup) | Agrees: markers unsupported everywhere |
| Events blocked 10/10: `timezone` required | Agrees; plus `programId` (8) and `schedule` (10) API gaps |
| API gaps: news `programId` 6, blog `category` 6, donation sections 4 | Agrees |
| Focal points withheld on 8 of 26 images | Agrees; captions are a second, unflagged gap (no source caption today) |
| Not mapped: Get Involved, policies (excluded), story strip, 3 code-only pages | Agrees |

The manifest cannot see: fields the adapter drops (homepage/About lists
above), fields no source record sets (project location…, story quotes),
admin-only gaps (`noIndex`, contact description, `features`), adapter
mappings (`seo.ogImageId`, `donations`, status flags), and the presence
rules below.

Fidelity: the source site and a site built from the rehearsal's 12 records
(test database, approved only in memory) were identical on 109/109 pages. That
proves the eligible records round-trip; it says nothing about the rest.

## Confirmed gaps, grouped

**1. Supported and safely migratable now** — programs, impact figures
(`pending-review` kept), Transparency, Careers; settings, About and Impact
already exist in production (reconcile by hand, never overwrite). Get Involved
fits the CMS field for field but needs a converter first.

**2. Schema / API / admin / adapter changes required**
- Presence rule (**risk**): news, blogs, events, appeals and team enter the
  snapshot once the organization has ANY record of the kind — draft or
  archived — so one draft replaces the website's whole list (PUB:332-333,
  389, 407-419; `repository.ts:201-207`).
- Policies: the API does not refuse working text; the web build does.
- Media: focal points and captions end to end.
- SEO: `noIndex` in every admin editor; `ogImageId`/`noIndex` mapped for
  posts, events, appeals, donation page; a default share image from settings.
- Posts/events: news `programId`, blog `category`, event `programId`,
  `schedule` in API + admin; a time-zone rule for events.
- Stories: `quotes`, `impact` (schema → adapter).
- Projects: location, stage, date, impact, partners, linked story.
- Donation/appeals: FAQ/trust/appeal-list sections on the donation page;
  statement `cta`/`kicker`, numberedCards `kicker`/`intro` editable and
  carried; hard-coded appeal headings; `designation`, `formOverrides`,
  `settings.donations` applied; `startsOn`/`endsOn` used or removed.
- Homepage/About fields stored but not rendered (listed in the matrix);
  mission read from one place; contact method `description` editable;
  `features.themeSwitcher` editor or removal; `branding` (needs the CSP and
  image pipeline first).
- External/`mailto:` CMS links: prove or fix rendering.

**3. Code-only features that need a CMS model** — `/about/how-we-work`,
`/impact/our-approach`, `/impact/where-we-work` (geography), giving methods
and legacy giving pages, figure icons, Get Involved hub SEO, homepage featured
projects (`featuredWork`: decide to render or retire), forms for travel and
fellowship.

**4. Sample / release-marked content that stays in code** — 50 records and
the marked page items above; program `stories` lines (unmarked samples);
23 `demo-` working photographs; policy working text. Migrating any of it drops
the release block.

**5. Needs human verification or approval** — impact figures and the
financial overview (pending review); governance/accountability text; real
contact details and social links; policy text and dates (RBB and counsel
only); consent for story subjects, authors, team and photos (nothing checks
media consent at publish); photo ownership; event times and time zones;
appeals and Givebutter campaign ids; careers roles; Get Involved operational
text; the approvals in `apps/web/release/approvals.mjs`.

## Risks

Milestone 9 (2026-10-11): the rehearsal converts the Get Involved hub
and four paths (`scripts/migration/getInvolved.mjs`) — planned `create`,
nothing withheld, round-trip identical on all five routes; no schema gap
found. The writer does not write them (offline plan only).
Milestone 8 (2026-10-11): homepage programs/getInvolved `body`+`cta`,
timeline/stories `body`, approach/appealList `highlight`; About statement
`cta`, missionVision `highlight`, numberedCards `intro`, approach
`highlight` — drawn and editable. Stored but intentionally not drawn:
getInvolved `imageIds`, closing cta `imageId`/`cardImageId` (no band draws
them; the source homepage does not either).
Milestone 7 (2026-10-11): donation-page and appeal `faq`, `trust` and
`appealList` sections accepted and drawn; statement kicker/highlight/link
and cards kicker/highlight/intro carried; CMS appeals use their own "why"
heading and kicker (source appeals keep the page's wording); the admin no
longer turns statements into rich text. Not applied, as payment-adjacent:
`designation`, `formOverrides`, `settings.donations`, `startsOn`/`endsOn`.
Milestone 6 (2026-10-11): project `location`, `stage` (the source's
`status`), `date`, `impact` ({ value, label }), `partners` and the linked
story (`storyId`, by id) are editable and carried end to end; the
rehearsal maps them (the story by reference). Sample projects stay in code.
Milestone 5 (2026-10-11): story `quotes` ({ text, attribution }, both
required as the website requires) and `impact` (plain lines) are editable
and carried end to end; the rehearsal maps them (no story schema gap left
for them). Sample stories still wait on the sample-content decision.
Milestone 4 (2026-10-11): news `programId`, blog `category`, event
`programId` and `schedule` are editable in the API and admin end to end
(no API gap left in posts or events); the event time-zone contract is
explicit (docs/PUBLISHING.md "News, blog and event fields"). Source events
remain blocked on `timezone` only: RBB must name the zone — it is never
inferred.
Milestone 3 (2026-10-11): sharing metadata is complete for every type with
it — `noIndex` editable everywhere, share images carried for news, blogs,
events, appeals and the donation page, and the site-wide default share
image applied (docs/PUBLISHING.md "Sharing metadata").
Milestone 2 (2026-10-11): image focal points and captions now travel from
the media library to the website (docs/MEDIA_LIBRARY.md). Milestone 1
(2026-10-11) addressed the first, third and fifth below: a
collection now appears only once it has been on the website (see
`docs/PUBLISHING.md`, "When a key appears"); policy working text is refused
from submission on and at publish; CMS external, `mailto:`, `tel:`, `#` and
site-path links are verified by render tests (no defect found).

- One draft or archived record of news, blogs, events, appeals or team
  silently empties that list on the next publish.
- First CMS story publish replaces every website story and needs the Impact
  page re-pointed in the same publish.
- An owner can publish placeholder policy text the build then refuses.
- CMS images lose their framing (focal points).
- External links from the CMS are untested.
- Production settings are a draft (r2) ahead of the published copy.

## Proposed milestones (dependency order)

Each ends with: the rehearsal regenerated (the gap disappears from the
manifest where applicable), the writer replayed on the test database, and a
fidelity build identical to the source site for everything not deliberately
changed. No production writes.

| # | Milestone | Depends on | Tests | Acceptance |
|---|---|---|---|---|
| 1 | **Publishing safety**: presence rule = at least one publishable record for news, blogs, events, appeals, team; API refuses policy working text; render test for external/`mailto:`/`#` CMS links | — | publishing unit tests (draft/archived never replaces a list); policy service test; web render test | a draft of any type changes nothing on the site; working-text policy refused at save |
| 2 | **Media framing**: focal point (and caption) in the media record, admin, `PublishedMedia`, publish copy, `imageOf` | — | contract, media service, snapshot, adapter, `EditorialImage` render tests | manifest `media-gap` = 0; CMS image renders with its focal point |
| 3 | **Sharing metadata**: `noIndex` editor everywhere; `ogImageId`/`noIndex` mapped for posts, events, appeals, donation page; settings default share image | 2 (images) | admin unit, adapter, seo.js tests | every type's SEO round-trips; default image used only on indexable pages |
| 4 | **Posts and events**: news `programId`, blog `category`, event `programId`/`schedule` editable; time-zone decision (RBB) | 1 | API service + admin smoke on the test database; adapter tests | manifest `api-gap` for posts/events = 0; events no longer blocked (once a time zone is decided) |
| 5 | **Stories**: `quotes`, `impact`, captions | 2 | contract, API, admin, adapter, StoryDetail render | story template fields all carried |
| 6 | **Projects**: location, stage, date, impact, partners, linked story | 1 | contract, API, admin, adapter, ProjectDetail render | `schema-gap` for projects = 0 |
| 7 | **Donation and appeals**: donation-page FAQ/trust/appeal-list sections; statement/cards fields; hard-coded headings become fallbacks; designation, form overrides, `settings.donations` applied | 1 | API, admin, adapter, donation render tests; Givebutter unaffected | donation FAQs editable; CMS headings shown; source site unchanged |
| 8 | **Homepage and About leftovers**: render or retire the dropped fields; one mission source; contact description editor; `features` editor or removal | 3 | adapter + render tests | no CMS field stored-but-dropped without a documented reason |
| 9 | **Get Involved in the rehearsal and writer** (converter; policies stay excluded) | 1 | rehearsal + writer tests; fidelity build | Get Involved planned `create`, round-trips identically |
| 10 | **New CMS models** for How We Work, Our Approach, Where We Work, giving methods, figure icons (needs RBB content decisions) | 1-3 | contract → render | each page editable; geography never sampled |

Then, separately and only with approval: replace samples with RBB's real
content (group 5), and a production migration of the eligible set
(reconciling the records that already exist).
