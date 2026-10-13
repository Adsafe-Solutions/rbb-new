# Site settings, publishing and the public snapshot (M5)

How CMS data reaches the public website safely: what is draft, what is
published, how the website build consumes it, and what happens when
something is missing or wrong.

```
Admin ──(session, settings:write)──▶ API ── site_settings   working copy ("draft")
Owner ──(publish:execute)─────────▶ API ── validate → published_snapshots (immutable, versioned)
                                            └─ publish_state.active → version N   (one atomic pointer move)
Web build ──GET /api/v1/public/snapshot──▶ API   (no session; this deployment's organization)
   └─ scripts/published-snapshot.mjs → Vite plugin → client + server builds → prerender → static HTML
```

The public website is built static from the snapshot and stays so: the
pre-rendered pages, search engines and a browser without JavaScript see
the snapshot the build applied. On top of that, a build made with
`RBB_SNAPSHOT_URL` also asks the API for the LATEST published snapshot in
the visitor's browser, so a publication shows on the next page load
without a rebuild — see "Runtime snapshot" below. MongoDB or the API
being down never takes the site down: the browser keeps the build's own
snapshot.

## Site settings

- **Contract:** `SiteSettings` in `packages/content-schema`, the M1
  contract, used unchanged. It's one record per organization, with these
  sections:
  - `general`, `contact`, `social`, `seo`, `engagement`
  - `countries` (#15): the admin's country selection (Settings → General,
    from the full ISO 3166-1 list). INTERNAL: saved like a section, never
    published — every snapshot leaves it out, and it is not a change to
    publish. The public Where We Work list is the Impact page's geography
    block.
  - retired (scope decision, 2026-10-13): `branding`, `analytics`,
    `donations` (form defaults) and `features`. Not editable in the admin
    or the API, never read by the website; the contract keeps them
    OPTIONAL only so the settings already stored and the snapshots already
    published stay valid. The website keeps its built-in logo and favicon,
    measures nothing, and leaves online donations to a later Givebutter
    phase; the theme switcher stays a deployment switch.
- **Not in the contract:** footer and navigation. They stay source-controlled
  in the website, and no editor for them exists yet.
- **Storage:** MongoDB `site_settings`, one document per organization: the
  record, a `revision`, `updatedAt` and `updatedBy`.
- **API:**
  - `GET /api/v1/settings` (`settings:read`, owners and editors)
  - `PATCH /api/v1/settings` (`settings:write`, owners only) with
    `{ revision, changes: { <section>: <whole section> } }`
- **Validation:** every save is checked against the contract (strict:
  unknown fields are refused, never dropped). Then the business rules run:
  contact method ids must be unique, and media references must be **ready
  media of this organization**. Finally the revision is checked.
- **Concurrency:** a stale revision returns 409, "These settings were changed
  elsewhere. Reload the latest version before saving."
- **Audit:** `settings.updated` records the changed field *paths* only (for
  example `contact.methods`), never values. `settings.imported` is recorded
  once.
- **First record:** RBB's real current values, not invented ones:
  ```sh
  pnpm --filter @rbb/web run export:settings        # the website's settings → apps/web/build-meta/site-settings.json
  pnpm api:build && pnpm api:settings:import -- --file apps/web/build-meta/site-settings.json   # production: add --production=risingbeyondborders
  ```
  The import creates the record only if none exists. It never overwrites,
  and nothing is published by it.

## Publishing

`POST /api/v1/publish` requires `publish:execute`, which is OWNER-only
(the M3 permission table).
1. **Lock** (`publish_state.lockId`, 60-second lease). A second publish gets
   409.
2. **Build the candidate:** the working settings marked `published`, plus
   exactly the media they reference: id, public URL, type, size and alt
   text. No storage key, consent or caption is included.
3. **Validate:**
   - the whole candidate against `PublishedSnapshot` (strict; references
     present; nothing unreferenced; the organization matches)
   - a scan for anything credential-shaped (key names or values)

   Any problem returns 400 and records `publish.rejected`. Nothing changes.
4. **Allocate the next version** with `$inc`: a counter, never a timestamp.
5. **Store** the snapshot (immutable, one per version), then **move the
   pointer** in one document update. Readers see the old snapshot or the
   new one, never a partial one.
6. **Audit** `publish.completed` with `{ version, previousVersion,
   deployment }`, then the deployment trigger runs.

A publish with no changes since the live version returns 409. The admin
shows the live version, who published it, whether the saved settings
differ (and in which sections), and a confirmation before publishing.
The publish takes the saved settings and the APPROVED content (M14, the
editorial workflow below) — and, of what is approved, only what is not
scheduled for later (M15, below). There is no preview environment.

**Deployment trigger** (`modules/publishing/deploy.ts`):
- **Default:** `NoDeploymentTrigger`, which reports `not-configured`. It never
  pretends to deploy.
- **With `DEPLOY_HOOK_URL`** (a secret): `WebhookDeploymentTrigger` POSTs
  `{ event: "snapshot.published", organization, version }`. Pass `version`
  to the build as `RBB_SNAPSHOT_VERSION`.
- **A failed hook** never fails the publish. It's logged and audited.

## The public snapshot

| Endpoint | Cache | Notes |
|---|---|---|
| `GET /api/v1/public/snapshot` | `no-cache` + `ETag: "snapshot-v<N>"` | The active version. Every read revalidates, and an unchanged snapshot costs a 304. So a build right after a publish always sees it: no stale CDN window |
| `GET /api/v1/public/snapshot/<N>` | `public, max-age=31536000, immutable` | A version that was once active. It never changes |

- **No session.** Read-only (POST gives 405).
- **Organization from deployment config only.** It comes from
  `ORGANIZATION_ID`. `?orgId=`, `X-Organization-ID` and cookies are never
  read.
- **Shape:** `{ data: { version, schemaVersion, generatedAt, organization,
  settings, media, content } }`. `content` is empty until a content module
  adds its own key to the contract.
- **Before the first publish:** 404.

## The website build

`npm run build` is:
`published-snapshot.mjs → vite build → vite build --ssr → prerender`.

| Variable (build environment) | Effect |
|---|---|
| `RBB_SNAPSHOT_URL` | The public snapshot endpoint (https; http only for localhost). **Unset: the site builds from its source content, byte-identical to before M5** |
| `RBB_SNAPSHOT_REQUIRED=1` | Fail the build if the snapshot can't be fetched (use once the CMS is the source of truth) |
| `RBB_SNAPSHOT_VERSION` | Fail if the snapshot is older than this (from the deploy hook) |
| `RBB_SNAPSHOT=off` | Ignore the snapshot entirely |

## Runtime snapshot

Publishing used to reach the live website only through a rebuild (the
deploy hook, or a manual Cloudflare Pages deployment). Since the runtime
snapshot, a build made with `RBB_SNAPSHOT_URL` ALSO fetches the latest
published snapshot in the browser, before the site's content modules
load, and applies it in place of the baked one when it is newer.

```
browser ──GET /api/v1/public/snapshot (simple cross-origin GET, no session)──▶ API
   │   304 / same version  → the baked snapshot, as pre-rendered (hydrate)
   │   newer version       → structure + organization + the full content
   │                         contract + "can this site draw it"
   │                         → applied before any content module loads → render afresh
   │   older / rejected    → the baked snapshot stays (never half-applied)
   └── unreachable         → the browser's cached copy, checked the same way;
                             with none, the baked snapshot stays
```

What this means in practice:

| Situation | What the visitor sees |
|---|---|
| Nothing published since the build (the usual page load) | The pre-rendered page, hydrated. One small request, a 304 under the browser's own ETag revalidation (`Cache-Control: no-cache` + `ETag: "snapshot-v<N>"`). No validation runs: a version never changes |
| A newer version is live | The pre-rendered page paints first; the newer content replaces it as soon as the request answers (default within 3 s), and the page is rendered afresh rather than hydrated against HTML it does not match. Everything derived from the content as the modules load — titles, the footer, the navigation, the routes — follows |
| The API is down or slow | The baked snapshot: the last one known to be valid. Never the website's own sample content, which a runtime build no longer carries in place of published content |
| An address the build did not pre-render (a story published after the build) | `404.html` answers with a "Loading…" status, then the page — the snapshot is loaded before the router runs. If the API could not be reached and the browser holds no copy, the page says it "cannot be shown right now", with a retry, instead of "not found" (still `noindex`) |
| Drafts, submissions, approvals not yet published | Invisible: the browser reads only the API's public snapshot, which holds published content only |

Rules and limits:

- **Checks are the build's checks.** A runtime snapshot passes
  `structuralProblems`, the `PublishedSnapshot` contract (loaded as its own
  chunk only when a newer version arrives) and `overridesFrom` — one
  failure rejects it whole. What the build cannot check at runtime stays
  a build matter: the site's own content validation (`content/validate.js`,
  links to pages that exist) runs at build time only.
- **Secrets, sessions:** none. The public endpoint needs no session; the
  request carries no custom header, so there is no preflight.
- **CORS:** the API's `WEB_ORIGIN` must be the public site's origin
  (`https://prod.risingbeyondborders.org` today), or the browser refuses
  the response and the site keeps the baked snapshot (status
  "unavailable"). This is an API environment setting, not a code change.
- **The page policy** gains exactly one `connect-src` origin (the API's)
  and the media library's origins in `img-src` — the origins of the baked
  snapshot's media, plus `RBB_MEDIA_ORIGINS` for a media domain the baked
  snapshot happens not to show yet. A page policy decided per page at
  build time stays as built: a newly published Givebutter checkout or
  homepage video is blocked by the CSP until the next build.
- **New addresses** (a story, project, profile, appeal or post published
  after the build) render in the browser, but the host answers them
  with `404.html` (HTTP 404), and the sitemap does not list them, until
  the next build. Keep the deploy hook: the rebuild is what makes a new
  page a 200 for search engines; the runtime snapshot is what makes it
  visible to people in the meantime.
- **One fetch per page load.** Client-side navigation keeps the version
  the page loaded with, so a visit never mixes two versions; a reload or
  a new visit picks up the newest.
- **Fail-safe:** should a chosen snapshot fail to apply to a module (a
  target this build of the site no longer has), the page reloads once
  without the runtime snapshot and shows the baked content.

| Variable (build environment) | Effect |
|---|---|
| `RBB_SNAPSHOT_RUNTIME` | `on` (the default when unset): the browser asks the API; `off`: keep the site fully static — the build bakes the snapshot and the browser never asks. Any other value fails the build |
| `RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS` | How long the browser waits for the API before going on with the baked snapshot (default 3000; 500–30000) |
| `RBB_MEDIA_ORIGINS` | Extra https origins (comma-separated) published images may load from |

Runtime fetching is on only for a build that applied a snapshot; a
source-content build (no `RBB_SNAPSHOT_URL`, or an unreachable API
without `RBB_SNAPSHOT_REQUIRED=1`) is static as before.

**Testing a publication end to end.**
1. `pnpm web:test` — `scripts/test/runtime-snapshot.test.mjs` (every
   outcome: fresh, unchanged, newer, malformed, API error, cached copy,
   timeout) and `runtime-snapshot-render.test.mjs` (the real site's
   modules, through the hook).
2. Build with the API: `RBB_SNAPSHOT_URL=https://api.<domain>/api/v1/public/snapshot
   RBB_SNAPSHOT_REQUIRED=1 RBB_SNAPSHOT_RUNTIME=on pnpm web:build` (or
   `pnpm deploy:web:check`, which also checks the result — apps/web/docs/DEPLOY_CLOUDFLARE_PAGES.md). `build-meta/runtime-snapshot.json` records the
   decision; `build-meta/security-headers.json` shows the API in
   `connect-src`.
3. Serve `dist/` (`pnpm web:serve`, or any static host) and open a page:
   the Network panel shows one request to the snapshot endpoint (200 on
   the first visit, 304 after).
4. Publish in the admin, reload the page: the change shows; the console
   has no hydration warning (the page rendered afresh).
5. Stop the API (or block the request): reload — the baked content
   shows, nothing else.

What the snapshot drives (`scripts/snapshot-adapter.mjs`):
- `general` → `BRAND`
- `seo.description` → `SITE.description`
- `contact` → `ORG_CONTACT` (methods, office, hours, response time)
- `social` → `ORG_CONTACT.social`, which feeds the footer

The values are set at the end of the module that defines them, in both the
client and server builds, so the HTML and the hydrated page agree, and
everything derived from them (titles, footer) follows.

Never driven: the retired `branding`, `analytics`, `donations` and
`features` (above). The CMS donation pages carry their own Givebutter
checkout, as described below; `engagement` drives the announcement bar,
the popup and Highlights (M21–M23).

## Content collections: posts and events (M6)

- **Admin CRUD** lives at `/api/v1/posts` and `/api/v1/events`, under the
  existing `content:*` permissions: owners and editors can read, create,
  update and archive. Publishing the website stays `publish:execute`,
  owners only.
- **Lifecycle:**
  - `draft` is never public.
  - `published` means the record goes into the **next** snapshot an owner
    publishes.
  - `archived` is excluded from snapshots. `DELETE` archives, and nothing
    is ever destroyed.

  Marking a record published is not publishing the website.
- **Posts:** news and blog articles, with a structured RichText body (never
  HTML), a featured image, SEO overrides, an excerpt, a date and an author.
  Stories are posts too, but their own module since M12 (see "Projects and
  stories"): `/api/v1/posts` never sees one.
- **Events:** date, start and optional end, written as the event advertises
  them, plus a **required** IANA time zone, which is never converted. The
  end must come after the start (a contract rule). Venue, address, map
  link, registration link (https), featured image (required) and SEO.
- **Addresses (slugs)** are unique per organization, enforced by a unique
  index.
  - Changing the address of a record that has been published needs explicit
    confirmation (`confirmSlugChange`).
  - The old address is kept as `previousSlugs` for a future redirect
    milestone. No redirect is created yet.
- **Media:** references must be ready images of the organization, checked
  on save for changed references. At publish, every reference is
  re-checked in one query, and one unavailable image blocks the whole
  publish.
- **Audit:** `post.created`, `post.updated` and `post.archived`, and the
  same three for events. They record field names only; body text is never
  recorded.

**Snapshot.** `content.news`, `content.blogs` and `content.events` hold the
published contract records, without editing timestamps or any admin
metadata.
- **When a key appears (Milestone 1):** only once the collection has been
  on the website — a record of that kind is publishable now (published, or
  approved and due), or one was ever published (it keeps `publishedAt`,
  even archived), or the live snapshot holds records of it. Drafts,
  submissions, approvals not yet due, and records archived before they were
  ever published never make the key appear. (Before Milestone 1 any record
  at any status did, so one draft emptied the website's list.)
- **Missing key:** the website keeps its source collection.
- **Present key, even empty:** the CMS is the source, and the website's
  sample items for that collection are gone from snapshot builds. An empty
  list is intentional: every record of the kind was published and has since
  been archived.
- The same rule applies to appeals and the team.

**Website.**
- **Collections:** `scripts/snapshot-adapter.mjs` replaces `NEWS`, `BLOGS`
  and `EVENTS` in `src/content/media.js` with the published records, in
  both builds.
- **Pages:** the article and event pages render RichText through
  `components/RichText`, which reuses the site's existing classes.
- **Images:** the media library's image origin is added to `img-src`, and to
  the build's approved third-party list, only for builds whose snapshot
  brings images.
- **Indexing:** detail pages keep the site's existing indexing rules (`noindex`
  until approved).

## Appeals and the general donation page (M7)

- **Admin CRUD:**
  - `/api/v1/appeals` is the shared content routes, with the existing
    `content:*` permissions. DELETE archives.
  - `GET` and `PATCH /api/v1/donation-page` cover the general donation page,
    ONE per organization (`content:read` / `content:update`).
    `{ revision, changes }`, where each change is a whole part (`hero`,
    `sections`, `donation`, `seo`, `status`). Revision 0 creates the page.
  - Publishing the website stays `publish:execute`, owners only.
- **Contracts:** the M1 `Appeal` and `GeneralDonationPage`, plus an optional
  typed `donation.checkout`:
  `{ provider: "givebutter", campaignId, widgetId, widgetType: "form", defaultAmount?, defaultFrequency? }`.
  It holds public ids only. The account id is the web build's
  `VITE_GIVEBUTTER_ACCOUNT_ID`, and the API key is server-only.
- **Sections:** only the blocks a donation page draws: one "why it matters"
  (`richText`, or `statement`) and one `numberedCards`. Others are refused
  at save rather than breaking the website build.
- **Givebutter verification** (`modules/donations/verify.ts`, through the
  existing `DonationProvider`):
  - **What is checked:** the campaign exists in the server key's account and
    is active. The defaults must be the campaign's own frequencies and
    amounts, and not below its minimum.
  - **When:** on the save that publishes a record (or changes a published
    record's checkout), and again for every checkout at website publish.
  - **A draft may hold an unverified checkout.**
  - **Unverifiable means blocked:** not configured, a refused key or an
    unreachable provider block the publish, and the live snapshot stays.
  - **The widget id cannot be verified** (Givebutter can't list widgets), so
    it is stored as the editor set it.
- **Snapshot:**
  - `content.appeals` holds published appeals. It appears once appeals
    have been on the website (Milestone 1: an appeal publishable now, or
    one ever published — never a draft alone). Present (even empty), it
    **replaces the website's sample appeals** in snapshot builds.
  - `content.generalDonation` holds the page, only while it is PUBLISHED.
    Absent (never published, or drafted/archived again), the website shows
    its own source donation page.
- **Media:** featured, story-circle, hero and share images must be ready
  images of the organization. They are checked on save, and again (all of
  them) at publish.
- **Audit:** `appeal.created`, `appeal.updated`, `appeal.archived` and
  `donation_page.updated`, with field paths only.

**Website.**
- **Collections:** `APPEALS` (`src/content/appeals.js`) and
  `PUBLISHED_GENERAL_DONATION` (`src/content/donation.js`) are set from the
  snapshot.
- **Form slot:** a page with a checkout draws Givebutter's Form widget
  there. Otherwise it draws the site's form, which is also what happens if
  the build has no account id (with a build warning).
- **Script loading and CSP:** the Givebutter library loads after hydration,
  once, on those pages only. Their policy alone gets the Givebutter origins.
- **SEO:** appeal pages and `/appeals` take their SEO title and description
  from the CMS. Indexing rules are unchanged: appeal pages stay `noindex`.
- **Announcements:** a bar message that points at an appeal or event this
  build doesn't have is dropped.

**Migration.** The four source appeals are sample content and are **not**
imported. Before the first CMS appeal, they stay. After it, the CMS is the
source for appeals in snapshot builds. The general donation page's source
copy stays until a CMS page is published.

## Who publishes (M8 correction)

> **Superseded by M14** (the editorial workflow, below): a save no longer
> sets `published` at all. The section stays as the record of M8.

Moving any content record INTO `published` is an owner's decision. This
covers posts, events, appeals, the general donation page and the homepage.
It uses the same permission as publishing the website (`publish:execute`).

- **Where it's enforced:** in the API services, by one shared rule
  (`modules/content/shared.ts` `assertMayPublish`). An editor's attempt
  returns 403 and writes nothing.
- **Editors** create and edit drafts, archive, and take records back to
  draft. They may also edit a record that is already published: it stays
  published, and their edit reaches the public only when an owner next
  publishes the website.
- **The admin** shows editors the Published option disabled, with "Only an
  owner can publish website changes."

## Homepage (M8)

- **API:** one homepage per organization (`homepages`, unique `orgId`).
  - `GET /api/v1/homepage` (`content:read`) returns it, or
    `{ record: null, revision: 0 }`.
  - `POST /api/v1/homepage` (`content:create`) creates it once.
  - `PATCH /api/v1/homepage` (`content:update`) takes
    `{ revision, changes: { sections?, seo?, status? } }`. Revision 0
    creates too. A stale save gets 409: "These homepage changes are out of
    date. Reload the latest version before saving."
  - `DELETE /api/v1/homepage` (`content:delete`) archives it.
- **Contract:** an ordered list of blocks in the shared envelope; see
  `packages/content-schema/README.md`. Unknown block types, HTML and release
  markers are refused. The hero comes first, and single blocks appear once.
- **References:** `postList`, `eventList` and `appealList` point at records
  by id.
  - **On save:** each must exist in this organization. When an owner saves
    the homepage as published, each must also be published.
  - **At website publish:** the snapshot contract checks every reference
    against the records the snapshot itself carries. A draft, archived or
    missing record blocks the whole publish, and the live version stays.
- **Media:** every image must be ready, belong to this organization, and is
  re-checked at publish.
- **Audit:** `homepage.created`, `homepage.updated` and `homepage.archived`,
  with block-level paths (`sections.<id>.data.heading`,
  `sections.<id>.enabled`, `sections.order`). Wording is never recorded.
- **Snapshot:** `content.homepage` appears only while the homepage is
  PUBLISHED, with its ENABLED blocks only.
- **Website:**
  - `PUBLISHED_HOMEPAGE` (`src/content/homepage.js`) is set from the
    snapshot, and `pages/Home` then draws `pages/Home/CmsHome.jsx`.
  - Each block is drawn by the component the source homepage uses for it,
    through an explicit type → renderer table. An unknown type fails the
    build.
  - **Colour:** every band keeps its source tone unless a neighbour has the
    same one; then it takes an alternative. The page never closes on Deep
    Trust Blue.
  - **SEO:** the homepage's SEO title, description and share image come from
    the CMS. `noIndex` can only remove it from the index.
- **Fidelity:** the source homepage, converted to CMS blocks and drawn
  through `CmsHome`, gives the same HTML as the source page (images
  excepted).
- **Migration:** the source homepage is not imported and not deleted. Before
  a CMS homepage is published, the source homepage is the homepage. After
  it, the CMS homepage is the source of truth in snapshot builds. Archiving
  it (or drafting it again) returns the website to the source homepage at
  the next publish.
- **Admin:** `/homepage` has the block list (show/hide, Move up/Move down,
  remove, add), each block's typed form, a draft preview (admin-only, never
  published or served), SEO and publishing, and the shared publish panel.
- **Not editable here:**
  - impact figures: the `stats` block names metric ids, but the figures and
    their verification stay in the website's source; the API cannot check
    those ids, and the website build fails on an unknown one
  - the get-involved photographs and the final ask's images: kept, but not
    drawn by the website

## About page and team (M9)

**About page.** A block page, like the homepage. Both run on one service
(`modules/pages`), and the admin uses one editor
(`apps/admin/src/blocks/BlockPageEditor`).
- **API:** one per organization (`about_pages`).
  - `GET /api/v1/about` returns it.
  - `POST /api/v1/about` creates it, once.
  - `PATCH /api/v1/about` takes `{ revision, changes }`; revision 0 creates
    too.
  - `DELETE /api/v1/about` archives it.
- **Blocks:** exactly the page's chapters:
  - page introduction (new)
  - who we are (`statement`)
  - mission and vision (new)
  - values (`numberedCards`)
  - how we work (the homepage's `approach` shape)
  - transparency: a placement only; its documents stay in the website's
    transparency records
  - closing ask (`cta`)

  Each appears at most once, and the introduction comes first. Unknown
  types, HTML and release markers are refused.
- **Audit:** `about.created`, `about.updated` and `about.archived`, with
  block-level paths.
- **Snapshot:** `content.about` appears only while the page is PUBLISHED,
  with its enabled blocks only.
- **Website:** `PUBLISHED_ABOUT` (`about.js`) is set from the snapshot, and
  `pages/About` then draws `CmsAbout.jsx` with the same components.
  - Each chapter keeps its address (`#who-we-are`, `#values`,
    `#how-we-work`, `#mission-vision`, `#transparency`), so the old
    `/about/<chapter>` addresses still land.
  - Pages that quote `ABOUT` (the mission line on the team and donation
    pages) keep the source wording.
  - The SEO title, description and share image come from the CMS when set;
    `noIndex` can only remove the page from the index.

**Team.** Team members are a content collection (`team_members`) with the
shared lifecycle.
- **API:** `GET`, `POST`, `PATCH` and `DELETE` (archive) at
  `/api/v1/team[/:id]`, with `content:*` permissions.
- **Fields:** name, role, group (`leadership` | `team`), profile address,
  short bio, biography, photograph, department/area, location, social
  links (https) and related pages (site paths).
- **Not stored:** contact details.
- **Order:**
  - A new member goes to the end.
  - `POST /api/v1/team/order` with `{ items: [{ id, revision }] }` sets
    everyone's position at once. Every revision is checked before anything
    is written, so a stale list gets 409.
  - The admin's Move up/Move down use it.
- **Photographs:** a ready image of the organization, with alt text from
  the media library.
  - On save: a member being published needs a described photograph.
  - At website publish: the snapshot refuses a published member's
    photograph without alt text.
  - In the build: the website's own content validator refuses it too.
- **Audit:** `team_member.created`, `team_member.updated` (including
  `order`) and `team_member.archived`.
- **Snapshot:** `content.team` holds published members in team order. Like
  news, the key appears once the team has been on the website (Milestone 1):
  a draft member never empties the website's team.
- **Website:**
  - `TEAM_MEMBERS` (`team.js`) is replaced in source shape, so the team
    grid, the profile pages, their routes, the sitemap rules and person SEO
    work unchanged.
  - A profile page exists only for a member with a biography.
  - The team page's own words (heading, intro, groups, empty state) stay
    source-controlled.
  - The media-library photographs are approved like other CMS images.

**Migration.**
- The source About page and team are not imported and not deleted.
- **About:** the source page shows until an About page is published here.
- **Team:** the source team (six sample role profiles) shows until the
  organization creates its first team member here. From then on, snapshot
  builds show only the CMS team's published members: an empty team shows
  the team page's empty state. The sample profiles' routes disappear in
  such builds, and new members' profiles appear.

**Fidelity.** The source About page and team, converted to CMS records and
built from a snapshot, give byte-identical HTML across all 109 pages once
image URLs and hidden sample markers are normalised. The routes are the
same 85, and the images, alt text and metadata match.

## Programs (M10)

**Programs** are the organization's areas of work: Our Work, the program
pages, the Our Work menu and the homepage's program cards. They are a
content collection (`programs`) with the shared lifecycle.
- **API:** `GET`, `POST`, `PATCH` and `DELETE` (archive) at
  `/api/v1/programs[/:id]`, with `content:*` permissions. Publishing is
  owner-only, as everywhere.
- **Fields:** title, address (`/work/<slug>`), icon (one of the site's line
  glyphs, `PROGRAM_ICONS`), description, a note for the sections without
  content, "Why this matters" paragraphs, and the "What we focus on",
  "The change we work towards" and "Stories" lines, plus SEO (title,
  description, share image, `noIndex`). Plain text only. There is no
  program image, because the website draws none.
- **Order:** the same as the team. Both run on one ordered-collection
  service (`modules/content/ordered.ts`, `ordered-routes.ts`) and one
  admin hook (`apps/admin/src/content/ordered.ts`).
  - A new program goes to the end.
  - `POST /api/v1/programs/order` with `{ items: [{ id, revision }] }`
    sets every position at once. Every revision is checked before
    anything is written, so a stale list gets 409.
  - The admin's Move up/Move down use it.
- **Audit:** `program.created`, `program.updated`, `program.archived`, and
  one `program.reordered` per reorder (`{ moved, total }`), never one event
  per program.
- **Snapshot:** `content.programs` holds published programs in order.
  - Unlike news or the team, the key appears only while at least one
    program is PUBLISHED — even after programs have been on the website.
    The whole site names its program areas, so an empty set must never
    replace them.
  - When the key is present, every program a CMS record names (an event's,
    post's or homepage timeline item's `programId`) must be published in
    the same snapshot, or the publish is refused.
- **Website:**
  - `PROGRAMS` (`work.js`) is replaced in source shape.
  - The program routes, the Our Work menu (`nav.js` derives its children
    from `PROGRAMS`), the Our Work index, the homepage's program cards, the
    media filters and the SEO rules all follow it unchanged.
  - A new program gets a pre-rendered page.
  - The homepage `programs` block keeps its contract: it shows every
    published program, in order.
  - Source projects and stories name programs by slug. Archiving or
    renaming a program they name fails the website build's content
    validator, until projects move into the CMS.

**Migration.** The source program areas are not imported and not deleted.
They show until the first program is published here; from then on,
snapshot builds show only the CMS's published programs.

**Fidelity.** The four source programs, created through the API and
published, give byte-identical HTML across all 109 pages. With no snapshot
configured, the build is byte-identical to the build before M10.

## Impact and transparency (M11)

**Impact figures** are the headline figures ("50K+ Lives Impacted Across
Communities"). They are an ordered content collection (`metrics`) with the
shared lifecycle, run on the same ordered-collection service as programs.
- **API:** `GET`, `POST`, `PATCH` and `DELETE` (archive) at
  `/api/v1/metrics[/:id]`, plus `POST /api/v1/metrics/order`
  (revision-checked, 409 on a stale list, nothing written).
- **Fields:**
  - `slug`: the figure's key, what `stats` blocks name it by.
  - `value`: the figure as written.
  - `label`.
  - `verification`: `pending-review` | `verified`. The site shows an
    unverified figure without counting it up, and the release stays
    blocked until it is verified.
  - `order`.
- **Named, never restated:** the homepage's `stats` block and the Impact
  page's `stats` block both name figures by key (`metricIds`). One value
  serves both pages, and no figure is copied into a page.
- **Audit:** `metric.created`, `metric.updated`, `metric.archived`, and one
  `metric.reordered` per reorder.

**The Impact page** is a block page like About (`impact_pages`;
`/api/v1/impact`, GET/POST/PATCH/DELETE). Its blocks are /impact's
chapters, each at most once, with the introduction first:
- `intro`
- `stats`
- `programImpact`: each program's impact line, by program slug
- `teasers`: the two posters
- `measurement`
- `stories`: by story id (M12: the CMS's stories once it has any)
- `trust`
- `cta`

Two more blocks are not drawn on /impact; they hold the words of its two
sub-pages (registry `page`), published with the Impact page:
- `approach` (#5) → `IMPACT.approach` (/impact/our-approach): `intro` and
  `principles`. The page opens with the mission, read from the published
  About page's Mission & Vision block (the source mission otherwise) —
  never restated on the Impact page.
- `geography` (#6) → `IMPACT.geography` (/impact/where-we-work): `summary`,
  `regions` (each with its countries) and ungrouped `countries`. Verified
  coverage only, never a sample. With both lists empty the page shows no
  list and stays `noindex`; with either, it is indexed.

Either, published empty, approves nothing (`status: "placeholder"`). The
source Impact record (`src/contract/importers.js`) carries the approach's
approved source words, and a geography block only once the source has a
verified list. The release approval `geography` (release/approvals.mjs) is
RBB's sign-off and is not set by a publish.

Decisions (2026-10-13): **D11** — Our Approach reuses the existing approved
content; the Listen → Partner → Act → Sustain framework is rejected and was
removed from the code (it must not be introduced); How We Work still awaits
RBB's wording. **D14** — countries are chosen in the admin from the full
ISO 3166-1 list (`packages/content-schema/src/common/countries.ts`), stored
by name, each once per block; the contract refuses any other name. The list
is the options, not RBB's coverage: the selection starts empty and only
what is selected and published is shown. No map.

Audit: `impact.created`, `impact.updated` and `impact.archived`, with
block paths.

**Transparency** is the Transparency chapter of the About page
(`/about#transparency`; there is no page of its own). It is ONE typed
record per organization (`transparency_pages`; `/api/v1/transparency`,
GET/POST/PATCH/DELETE), not a block page.
- **Content:**
  - the chapter's kicker, heading and opening line
  - the financial overview: a year, its verification, and shares that
    must add up to 100%. Shares only, never amounts.
  - governance (optional)
  - "How we report" (paragraphs)
- **Service:** the single-page service (`modules/pages`) takes typed
  `parts` for it instead of blocks. Each PATCH replaces whole parts, and
  `null` clears an optional one.
- **Audit:** `transparency.created`, `transparency.updated` and
  `transparency.archived`, with part paths (`financialOverview.items`).

**Transparency documents** are annual reports, financial information and
governance documents. They are an ordered collection (`reports`;
`/api/v1/reports[/:id]` plus `/order`), each with:
- a category, title, optional year and a short type label
- `fileUrl`: an **https:// link**. The media library holds images only and
  there is no second file store, so a document links to where the
  organization publishes the file. Never a placeholder.

Audit: `report.created`, `report.updated`, `report.archived` and
`report.reordered`.

**Snapshot.**
- `content.metrics` and `content.reports` appear once at least one record
  is PUBLISHED, like programs.
- `content.impact` and `content.transparency` appear only while they are
  PUBLISHED; the Impact page carries its enabled blocks only.
- Once `metrics` is present, every `stats` block (homepage and Impact
  page) must name published figures.
- Once `programs` is present, the Impact page's program lines must name
  published programs.
- A broken reference refuses the whole publish, and the live snapshot
  stays.
- Story slugs and, without CMS figures or programs, the names of the
  website's own figures and programs are checked by the website build.

**Website.**
- `IMPACT.metrics` (`impact.js`) is replaced by the published figures.
  Every `stats` block resolves names through one helper (`metricStats`),
  so the homepage and /impact cannot disagree.
- `PUBLISHED_IMPACT` makes `pages/Impact` draw `pages/Impact/CmsImpact.jsx`,
  an explicit renderer table using /impact's own components. The anchors
  `#at-a-glance`, `#measurement` and `#stories` are kept.
- `TRANSPARENCY` / `TRANSPARENCY_COPY` (`transparency.js`) take the
  published record and documents in their own shape, so
  `TransparencySection` is unchanged. The overview's heading and caption
  are read when drawn, so a new year shows.
- Every trust panel (homepage, About, Impact, donation and contact pages)
  shows `transparencyLinks()`, derived from the transparency content: the
  overview, each document list once it has a published document,
  governance once there is any, and "How we report".
- The Impact page's SEO comes from the CMS when set; `noIndex` can only
  remove the page.
- `/impact/our-approach` and `/impact/where-we-work` stay
  source-controlled.

**Migration.**
- Nothing is imported and nothing is deleted.
- The website keeps its own figures until a figure is published here, its
  own /impact until an Impact page is published, its own transparency
  until the record is published, and its (empty) document lists until a
  document is published.
- Publishing the first figure makes the CMS the source of all figures.
  Create all three (keys `lives`, `countries`, `partners` match the names
  an existing homepage uses) before publishing any.

**Fidelity.** The source figures, Impact page and transparency, created
through the API and published, give byte-identical HTML across all 109
pages. This also holds with the source homepage as CMS blocks naming the
CMS figures. With no snapshot configured, the build is identical to M10's.

## Projects and stories (M12)

**Projects** are an ordered content collection (`projects`) with the
shared lifecycle, on the ordered-collection service (like programs).
- **API:** `GET`, `POST`, `PATCH` and `DELETE` (archive) at
  `/api/v1/projects[/:id]`, plus `POST /api/v1/projects/order`
  (revision-checked: a stale list gets 409, nothing written).
- **Fields:** exactly what the ten source projects use: address, title,
  program (`programId`, a program's slug), description, photograph,
  "The challenge" and "How the work is approached" (paragraphs), "What
  this work focuses on" and "What it aims to change" (lines), `featured`,
  `order`, SEO.
  - The project template can also draw a location, a stage, verified
    impact figures, partners and a story. No project supplies any, so
    they are not in the contract. If a source project ever sets one,
    conformance fails loudly rather than dropping it.
- **Audit:** `project.created`, `project.updated`, `project.archived`, and
  one `project.reordered` per reorder.

**Stories** are posts of type `story`, as the M1 contract already defined
them: one article model, in the `posts` collection beside news and blogs.
They are their own module.
- **Scoped store:** a store scoped to `story` (`MongoContentStore`
  `types`), routes at `/api/v1/stories[/:id]`, and audit as
  `story.created`, `story.updated` and `story.archived`.
- **Posts never see stories:** the posts module's store is scoped to news
  and blog, so `/api/v1/posts` never sees, edits or counts a story.
- **Unique addresses:** an address is unique across all posts (the
  collection's index).
- **Fields:**
  - title, address, category (one of the four story types,
    `STORY_CATEGORY_IDS`), excerpt
  - optional date, author and location
  - image and gallery (media library)
  - body as structured RichText (never HTML)
  - program (slug), project (slug), related stories (story ids)
  - `featured`, SEO
- **Order:** stories are date-driven, newest first. Undated ones come in
  the order they were added, so there is no manual order.

**References, checked at save** (`content/shared.ts`
`referenceProblems`):
- What they cover: a project's program, a story's program, project and
  related stories, and the Impact page's programs and stories.
- **Not managed yet:** while the organization has no CMS record of the
  named kind, the website's own records are named, and the website build
  checks them.
- **Managed:** once it has some, a reference must name one of its own
  records that is not archived. A record saved as published may only name
  published ones.
- **Archiving is never blocked** by what a record names.

**Images:** a published story's or project's images must be described
(alt text), checked at save, at website publish and in the build.

**Snapshot.**
- `content.projects` and `content.stories` appear once at least one is
  PUBLISHED. The homepage, /impact, program pages and other stories point
  at them, so an empty set must never wipe the website's own.
- Projects are in order. Stories are newest first by date, then in the
  order they were added.
- **Relationships checked atomically:**
  - a project's program is published, once the CMS manages programs
  - a story's project and program are published, once those are managed
  - a story's related stories are published stories (never itself)
  - at most one story is featured
  - the Impact page's stories are published stories
  - images are described

  A broken relationship refuses the whole publish, and the live snapshot
  stays.

**Website.**
- `PROJECT_RECORDS`, `PROJECTS` (`work.js`) and `STORIES` (`stories.js`)
  are replaced in their own shapes, so the routes, the hub, the program
  pages, the featured projects, the homepage's newest stories and project
  cards, and the related stories all follow.
- Story bodies render through `components/RichText`. Plain text renders
  without a wrapper, so a CMS paragraph is the source paragraph's HTML.
- CMS SEO overrides apply to the project and story pages; `noIndex` can
  only remove a page.
- The Impact page names stories by id (`storyIds`; M11's typed
  `storySlugs` replaced).

**Project source (M31.1).** `PROJECT_SOURCE` (`work.js`) works like
`STORY_SOURCE`. It is `{ cms: false }` by default, so the source projects
are the projects. The website's adapter sets it to `{ cms: true }`
alongside `PROJECT_RECORDS` and `PROJECTS` once the snapshot carries
`content.projects`, which happens when at least one CMS project is
published. The CMS projects are then the only projects.

A story's `projectId` is checked by `validate.js` through
`lib/storyProjects.js`:

| Projects | Stories | A `projectId` not on the site |
|---|---|---|
| the website's own | the website's own | error: the build stops (unchanged) |
| CMS | the website's own | **warning**: the source story names a source project that is gone; its page shows no project link |
| CMS or the website's own | CMS | error. With CMS projects, the snapshot contract refuses it first |

The warning only keeps the build working. It approves nothing: the sample
stories keep their `releaseMarker` and stay a launch-readiness blocker
until real stories replace them.

**Admin:** `/projects` (ordered list), `/projects/:id`, `/stories`,
`/stories/:id`. The program, project and story pickers (`content/pickers`)
list only this organization's records that are not archived. Until a
collection is managed in the CMS, they fall back to typed addresses.

**Migration.** Nothing is imported and nothing is deleted. The website
keeps its own projects until one is published here, and its own stories
until one is published here. From then on, published CMS records are the
source. The CMS records carry no "Sample" release markers.

**Fidelity.** Every source story and project created through the API (with
the source programs, Impact page, homepage, figures and transparency), and
published, gives byte-identical HTML across all 109 pages once image URLs
and hidden sample markers are normalised. All 859 images keep their alt
text. With no snapshot configured, the build is identical to M11's.

## Careers (M13)

**The Careers page** (`/about-us/careers`) is ONE typed record per
organization (`careers_pages`; `/api/v1/careers`, GET/POST/PATCH/DELETE).
It runs on the single-page service with named parts, as the Transparency
record does.
- **Fields:** exactly what the page draws:
  - the header: kicker, title, opening line
  - "Why work with us" (optional)
  - "Open opportunities": a heading, the line shown with no role, and the
    open roles in order
  - "How to apply" (optional)
  - the closing ask
  - SEO: title, description, `noIndex`. There is no share image, because
    the page has none.
- **Roles:** a role is what the page lists, its title. There are no role
  pages, application forms or application links on the site, so there is
  no jobs collection, no ordering service and no recruitment fields.
  Roles are ordered within the record (the editor's Move up/down).
- **Audit:** `careers.created`, `careers.updated` and `careers.archived`,
  with part paths (`opportunities.roles`).
- **Index:** `orgId_unique` only. Every read and write goes by
  organization.

**Snapshot.** `content.careers` appears only while the page is PUBLISHED,
the same rule as the About and Transparency records. A draft or archived
page never replaces the website's own page.

**Website.** The published page fills `CAREERS` (`contact.js`) in its own
shape, so `pages/Careers`, its validation and the Contact page's link work
unchanged.
- A section the record leaves out is left out of the page.
- The roles become the site's verified roles. As before, the page is
  indexed only with an open role, its approval area permitting.
- Without its own SEO description, the page uses the site's.
- The address is the site's own.

**Admin:** `/careers`, one editor.

**Fidelity.** The source Careers page, created through the API and
published, gives byte-identical HTML across all 109 pages (normalised for
asset hashes), with identical CSS and routes. Drafting it again brings the
source page back.

**The How We Work page** (#7, `/about/how-we-work`) is ONE typed record
per organization (`how_we_work_pages`; `/api/v1/how-we-work`,
GET/POST/PATCH/DELETE), on the single-page service with named parts, as
Careers.
- **Fields:** the header (kicker, heading, opening line); "In practice" —
  a kicker, a heading and one to eight cards (title, line, one of the
  site's line glyphs); one to eight numbered passages (heading, passage,
  optional list). The two posters, the closing ask and the page's SEO stay
  the site's.
- **Audit:** `how_we_work.created`, `.updated`, `.archived`, with part paths.
- **Index:** `orgId_unique` only.
- **Snapshot:** `content.howWeWork`, only while PUBLISHED.
- **Website:** fills `HOW_WE_WORK` (`about.js`) — the header and passages on
  the object, the cards on `HOW_WE_WORK.practices` — so `pages/HowWeWork`
  works unchanged.
- **Admin:** `/how-we-work`, one editor. The words are RBB's (D11); nothing
  is pre-filled.
- Migration: the rehearsal lists the page as `excluded-by-policy` — its
  source wording is working placeholder prose awaiting D11.

## Policies (M19)

**The site policies** are exactly THREE records per organization, each with
a fixed id and a fixed address. An editor can neither add a policy, rename
one nor move it.

| Id | Address | Title on the site |
|---|---|---|
| `privacy` | `/privacy` | Privacy Policy |
| `terms` | `/terms` | Terms of Use |
| `donation` | `/donation-policy` | Donation Policy |

Cookies is not a CMS policy. The site has no cookie page until the
production technology is assessed and RBB decides a disclosure is needed
(Document 13 §6).

**No legal text is written by the system.** A new policy holds only the
site's title and its cross-links. Every word and both dates come from RBB,
reviewed by counsel. The editor says so on an empty policy.

- **Contract:** `Policy` (`packages/content-schema/src/policies/policy.ts`).
  - Fields: title, `effectiveDate` and `lastUpdated` (ISO calendar dates,
    impossible dates refused), intro paragraphs, and sections in order.
  - Each section has a stable `id` (its page anchor, a slug), a heading,
    paragraphs and an optional bullet list.
  - `contactReference` is the id of a contact method in the
    organization's settings, never a typed-in address.
  - `relatedPolicies` holds the other two ids only. `seo` holds a
    description only.
  - Plain text only: no HTML, no rich text, no unknown fields, no release
    marker.
- **Approval:** approving (or publishing) needs both dates and at least
  one section (`policyApprovalProblems`). Submitting and approving also
  check that the contact is still in the settings.
- **Working text (Milestone 1):** a policy whose intro or a section carries
  working-placeholder text ("Demo text —", "WORKING text —", example.org
  addresses … — `common/workingText.ts`, the website's own rules) can be
  saved as a draft while it is written, but is refused on submit, approve,
  schedule and publish (`policyWorkingTextProblems`), with the part's path.
  Before, the API accepted it and the website build failed after the
  publish (`policiesFrom`).
- **API:** the single-page service with named parts, as Careers. Each
  policy is keyed by `policyId` in the shared `policies` collection
  (`orgId_policyId_unique`).

  | Method | Route | Purpose |
  |---|---|---|
  | GET | `/api/v1/policies` | All three, with their state, and the contact methods a policy may name |
  | GET, POST, PATCH, DELETE | `/api/v1/policies/<id>` | One policy. PATCH with revision 0 creates it |
  | POST | `/api/v1/policies/<id>/{submit,withdraw,approve,reject,schedule,unschedule}` | Workflow and scheduling |

  An id other than the three has no route (404).
- **Audit:** `policy.created`, `policy.updated`, `policy.archived` and the
  workflow actions. Each entry records the policy id as `resourceId` and
  the changed part names (`sections`, `effectiveDate`), never the wording.

**Snapshot.** `content.policies` lists the PUBLISHED policies, in the
fixed order. It is present only once at least one is published.
- While a newer revision waits for review, the version already live stays
  in the snapshot.
- The snapshot contract checks each policy again: published, this
  organization's, complete, and its contact in the snapshot's settings.

**Website.** `scripts/snapshot-adapter.mjs` (`policiesFrom`) merges each
published policy into its record in `POLICIES` (`content/policies.js`), by
id. That record drives the policy page, the footer's legal links, the
forms' privacy link, the donation form's policy link, SEO and the
pre-render.
- The CMS policy replaces the source record and its working text, and is
  final. Its id and address stay the site's.
- A policy the snapshot does not carry keeps its source record.
- `content/policies.js` is not changed by M19. Without a published policy,
  the build is byte for byte what it was.
- The build fails, with the reason, on a policy id the site does not know,
  a policy that is not published or not complete, or text carrying a
  working-placeholder marker (`lib/releaseMarkers.js`).

**Release gate.** Publishing a policy never satisfies the `policies`
approval in `apps/web/release/approvals.mjs`. That stays a separate,
manual RBB decision.

**Admin:**
- `/policies`: the three policies, each with its status, whether a
  version is on the website, its schedule and its effective date.
- `/policies/:id`: one editor per policy.

**Verification.** With no CMS policy published, a build is byte-identical
to the pre-M19 build: all 260 output files, 85 routes and 23 redirects. A
fixture snapshot with a published Privacy Policy puts the policy on
`/privacy`, in the footer link and in the contact form's privacy link,
while Terms and Donation keep their source records.

## Get Involved (M20)

**The Get Involved pages** are exactly FIVE records per organization, each
with a fixed id and a fixed address:

| Id | Address | Contract |
|---|---|---|
| `hub` | `/get-involved` | `GetInvolvedHub` |
| `volunteer` | `/get-involved/volunteer` | `GetInvolvedPath` |
| `fellowship` | `/get-involved/fellowship` | `GetInvolvedPath` |
| `partner` | `/get-involved/partner` | `GetInvolvedPath` |
| `travel` | `/get-involved/travel` | `GetInvolvedPath` |

**What a path IS stays the website's.** That means its title and button
label, route, icon, images, form and `featured`, plus the questions panel,
the path pages' shared closing and the hub's Work and Impact teasers. The
CMS holds only the words. A record starts EMPTY: nothing is seeded or
imported. A page that is not published, and any part a published page
leaves out, keeps the website's own words.

The legacy giving pages (`/giving`, `/gifts`, `/giving/major-giving`,
`/giving/zakat`) were retired (D35, 2026-10-13); the first three forward to
Donate (`/appeals`).

- **Path** (`packages/content-schema/src/getInvolved/getInvolved.ts`):
  - `shortDescription`: the card line and the page lead.
  - `hubNote`: the path's line on the hub.
  - Sections, in order: a stable slug `id` (the page anchor), a heading,
    paragraphs and an optional bullet list. `inquiry` is reserved for the
    form section. Ids and headings are unique.
  - An optional FAQ: a heading and unique question/answer pairs.
  - An optional SEO description.
- **Hub:**
  - Heading and introduction.
  - `ways` and `choose`: a kicker and heading each.
  - `why`: optional. Absent, the mission paragraph stays.
  - `closing`: a heading and one or two calls to action. Each is a
    `{ label, target }`, where `target` is one of `appeals`, `work`,
    `impact`, `contact`, `get-involved` or `about`. The website maps a
    target to its route, so an editor never types an address.
- **Text rules:** plain text only. No HTML, no rich text, no release
  marker, and no working-placeholder text. `common/workingText.ts` mirrors
  `apps/web/src/lib/releaseMarkers.js`, and a parity test fails if the two
  drift.
- **Approval:** a path needs its short description and a section; the hub
  needs its heading and introduction.
- **API:** the single-page service with named parts, keyed by `pageId` in
  `get_involved_pages` (`orgId_pageId_unique`).

  | Method | Route | Purpose |
  |---|---|---|
  | GET | `/api/v1/get-involved` | All five, with their state |
  | GET, POST, PATCH, DELETE | `/api/v1/get-involved/<id>` | One page. PATCH with revision 0 creates it |
  | POST | `/api/v1/get-involved/<id>/{submit,withdraw,approve,reject,schedule,unschedule}` | Workflow and scheduling |

  Any other id has no route (404).
- **Audit:** `get_involved.*` entries record the page id as `resourceId`
  and the part names (`closing.primary`), never the wording.

**Snapshot.** `content.getInvolved` lists the PUBLISHED pages in the fixed
order (hub first). It is present only once at least one is published. A
pending edit keeps the live version.

**Website.** `getInvolvedFrom` (`scripts/snapshot-adapter.mjs`) assigns
into the objects `content/getInvolved.js` already exports, using NESTED
targets: `GET_INVOLVED.paths` by id, and `GET_INVOLVED_PAGES.hub`, `.ways`,
`.choose`, `.why`, `.closing` and `.choose.notes`. `appendOverrides`
accepts a dotted name and fails if the target is missing.
- Every reader of the path records follows: the path pages, the hub, the
  cards on the home, Work, Contact and Team pages, the menu, the footer,
  the Contact form's path choice, and SEO.
- `src/` is unchanged.
- The build fails, with the reason, on an unknown id, an unpublished or
  incomplete page, an unknown target, or working-placeholder text.

**Admin:**
- `/get-involved`: five rows, each with its status, whether a version is
  on the website, and its schedule.
- `/get-involved/:id`: the hub editor or a path editor.

**Verification:**
- **No CMS page published:** the build is byte-identical to the pre-M20
  build (260 files, 85 routes, 23 redirects).
- **The current source content published as CMS records:** all 109 HTML
  pages are identical once asset hashes are normalised.
- **An edited Volunteer page:** the change reaches exactly the 9 pages
  that show its line today, plus its meta description. Routes, nav,
  footer, form options, legacy giving pages and redirect pages are
  unchanged.

## Announcement bar (M21)

**The announcement bar** is ONE typed record per organization:
`AnnouncementBar` in `packages/content-schema/src/engagement/engagement.ts`,
stored in `announcement_bars` (`orgId_unique`). It holds the bar's
messages in rotation order, so the bar is written, approved, scheduled
and published as a whole, like Careers' roles. The existing per-item
`Announcement` contract still describes the website's own source items.

- **Messages:** 1–10 of them. Each has a generated id, a line of up to
  140 characters, and an optional link `{ label, href }`.
- **Links:** `href` must be a path on this site, because the bar links
  with the site's router. `content/validate.js` fails the build unless the
  path is one of the site's pages.
- **Text rules:** plain text only. No HTML, release marker or
  working-placeholder text.
- **No time windows:** `startsAt` and `endsAt` are refused. To start a
  message, schedule the bar's publication. To end one, publish a new
  revision without it, or archive the bar.
- **API:** `/api/v1/announcement-bar` with GET, POST, PATCH (revision 0
  creates) and DELETE (archive), plus the workflow and scheduling actions.
- **Audit:** `announcement_bar.*` entries record the part name only
  (`items`).

**Precedence on the website.** Nothing changes in a build without a
snapshot.

| Question | Answer, highest priority first |
|---|---|
| Which messages? | The PUBLISHED bar's messages (`content.announcementBar`), else the site's own (`content/announcements.js`) |
| Is the bar on? | `VITE_ANNOUNCEMENT_BAR` (a deployment override), then the published settings' `engagement.announcementBar.enabled` in any snapshot build, then the site's own `enabled` |
| How long is each message shown? | The published settings' `intervalMs` in a snapshot build, else the site's own |

The bar never shows without a message. Drafts and approved-but-unpublished
bars never reach the snapshot. To hide the bar, switch it off in its
display settings. Archiving the bar brings back the site's own messages.

**Admin:** Engagement → Announcements (`/announcements`). It has one
editor for the messages, and a "Display" panel for owners that saves
`engagement.announcementBar` through the settings API.

## Popup (M22)

**The site popup** is ONE typed record per organization, in the existing
`Popup` contract, stored in `popups` (`orgId_unique`).
- **Content:** key, kicker, heading, highlight, body, a media-library
  photograph, a call to action, the close-button words, a delay, a
  frequency and the excluded pages.
- **Website rules** (`popupCmsProblems`, applied by the API and by the
  snapshot):
  - The call to action is a page of this site. The popup links with the
    router, and `content/validate.js` checks the page exists.
  - No `includePaths`, `startsAt` or `endsAt`: the popup cannot honour
    them.
  - No release marker, and no working-placeholder text.
- **Photograph:** a ready image of this organization. It must have alt
  text before the popup can be submitted (the snapshot checks again). It
  travels in the snapshot's media, its origin goes into the CSP, and it
  counts as "in use" for media deletion.
- **`key`:** what a visitor's "closed" is remembered against. A new key
  shows the popup again to everyone who closed it.
- **API:** `/api/v1/popup`, plus the workflow and scheduling actions.
- **Audit:** `popup.*` entries record part names only.

**Precedence on the website.** Nothing changes in a build without a
snapshot.

| Question | Answer, highest priority first |
|---|---|
| Which popup? | The PUBLISHED popup (`content.popup`), else the site's own (`content/announcements.js`) |
| Is it on? | `VITE_SITE_POPUP`, then the published settings' `engagement.popup.enabled` in any snapshot build, then the site's own `enabled` |

- The published popup replaces the source fields. The parts it leaves out
  (kicker, highlight) are cleared, not kept from the sample. Its `close`
  label stays the site's.
- The popup opens client-side after hydration, so the pre-rendered HTML
  carries only the CSP origin of its photograph.

**Admin:** Engagement → Popups (`/popups`). It has one editor, and an
owner-only "Display" switch that saves `engagement.popup`.

## Highlights — the story strip (M23)

**The story circles over the navbar** already come from appeals. Each
appeal's `highlight` (a shorter circle label and another photo) is edited
with the appeal and published through the appeal's workflow. M23 adds
ONE typed record per organization, `StoryStrip`, stored in `story_strips`
(`orgId_unique`).
- **Content:** `appealIds`, the appeals the circles show, in order, at
  most `STORY_STRIP_LIMIT` (4, the website's own limit).
- **Labels and photos:** each circle's label and photograph stay the
  appeal's own. Without a highlight, the circle uses the appeal's title
  and photo.
- **References:** every appeal named must be one of this organization's,
  not archived. From the strip's submission for review, each must be
  approved, published, or live in an earlier version. In the snapshot,
  each must be published in the same snapshot. Archiving the strip is
  never refused.
- **API:** `/api/v1/story-strip`, plus the workflow and scheduling
  actions.
- **Audit:** `story_strip.*` entries record the part name (`appealIds`).

**Precedence on the website.** Nothing changes in a build without a
snapshot.

| Question | Answer, highest priority first |
|---|---|
| Which appeals, in what order? | The PUBLISHED strip (`content.storyStrip`), else the site's rule: highlighted appeals, newest first |
| Are the circles on? | `VITE_STORY_STRIP`, then the published settings' `engagement.storyStrip.enabled` in any snapshot build, then the site's own `enabled` |

**How the order is applied.** The strip's order goes into
`APPEAL_STORIES.order` (`null` in the site's own content), and
`storyAppeals()` in `content/appeals.js` follows it when it is set —
the strip's appeals in its order, never one it names that is not there
— and takes highlighted appeals in list order otherwise. (Until the
runtime snapshot this was a build-time rewrite of one expression; a value
the browser can apply replaced it.) The appeal lists keep their own
order, and every other part of every page is unchanged.

**Admin:** Engagement → Highlights (`/highlights`). Up to four circles,
each choosing an appeal, reordered with Move up and Move down. Owners get
a "Display" switch that saves `engagement.storyStrip`.

## Editorial approval and publishing (M14)

One workflow for every content record and page: posts, events, appeals,
the general donation page, the homepage, About, team, programs, impact
figures, transparency documents, the Impact page, Transparency, projects,
stories, Careers, the three policies (M19), the five Get Involved
pages (M20), the announcement bar (M21), the popup (M22) and Highlights
(M23). Site settings are configuration and keep their M5 rule
(see "Settings" below).

```
draft ──submit──▶ submitted ──approve──▶ approved ──(website publish)──▶ published
  ▲                  │  │                    │                              │
  └────withdraw──────┘  └──reject──▶ draft ◀─┴──reject / any edit ◀────────┘
any ──archive──▶ archived ──reopen──▶ draft
```

**What "published" means:** this exact revision is in the live snapshot.
Only the website publish sets it. Nothing is duplicated: one document per
record, and no approval collection.
- **`publishedRevision`** on the stored document is the revision in the live
  snapshot. Archiving clears it.
- **A record published before M14** has no marker. Its status says it.
- **`live`** in every admin view says whether a version is on the website.

**Moving a record:** explicit actions, each naming the revision on screen.
- `POST /api/v1/<collection>/:id/{submit|withdraw|approve|reject}`
- `POST /api/v1/<page>/{submit|withdraw|approve|reject}` for `homepage`,
  `about`, `impact`, `transparency`, `careers`, `donation-page`,
  `policies/<id>` (M19) and `get-involved/<id>` (M20)
- body `{ revision }`

| Action | From | To | Who |
|---|---|---|---|
| submit | draft | submitted | owners and editors (`content:update`) |
| withdraw | submitted | draft | owners and editors (`content:update`) |
| approve | submitted | approved | owners (`content:approve`) |
| reject ("Return to draft") | submitted, approved | draft | owners (`content:approve`) |

Each action is checked in this order:
1. **Authentication**, and the route permission (403).
2. **The organization:** another organization's record is a 404.
3. **The revision:** a stale one is a 409.
4. **The state:** an impossible move is a 409 (`body.action`). draft→approve,
   submitted→submit and archived→anything are all refused.
5. **The full validation** for submit and approve: media, references, alt
   text, and the Givebutter checkout on approve.
6. **One revision-guarded write.** Of two racing requests, one wins.
7. **The audit event:** `<kind>.submitted`, `.withdrawn`, `.approved` or
   `.rejected`, with `{ from, to, revision }` and never any wording.

**Saving** (PATCH) never changes the status, so a save cannot publish
(`status` in a save is a 400). The one exception is reopening an archived
record as a draft. The rules for edits:
- **An edit to an approved or published record** makes it a draft again.
- **A submitted revision is locked** (409) until it is withdrawn or returned
  to draft.
- **An archived record** is reopened first.
- **New records** start as drafts.

**The website publish** (`POST /api/v1/publish`, `publish:execute`,
owners) takes, under the publish lock:
- **every APPROVED or PUBLISHED revision**
- **for a record being edited** (draft or submitted, with `publishedRevision`
  set): its LIVE version, carried forward from the active snapshot. An
  ordered collection keeps the editor's current order.
- **never** a draft, a submission, an archived record or a revision that was
  never approved

The candidate is validated as a whole: the contract, media, cross-references
and the secret scan, and Givebutter checkouts are verified again. A problem
refuses the whole publish, and the live snapshot stays. Once the pointer
moves, what went live is marked: approved → published, `publishedRevision`
recorded, a first `publishedAt` set, and no new revision. A mark that fails
is logged and repeated by the next publish, because the snapshot is the
truth.

**Concurrency:** `GET /api/v1/publish/status` returns a `changesKey` naming
exactly what would be published. The admin sends it back with the publish,
`{ changesKey }` (optional). If an approval, an edit or another publish
changed what would be published since the review, the publish is refused
with 409. The key does not depend on the clock: a first publish's date is a
placeholder until the publish stamps it.

**Review queue.** The status also lists the approved revisions the next
publish takes (`review.approved`) and the revisions waiting for review
(`review.submitted`). Up to 50 are named per collection, and
`review.totals` counts them all. It also lists `blockers`: the publish's
own checks without the donation provider, the first 20.

**Relationships.**
- **Submit** checks that every reference exists and is not archived.
- **Approve** also requires each referenced record to be approved,
  published, or live in an earlier version: "which is not approved yet —
  approve it first".
- **The website publish** checks everything again.
- **Figures named by the homepage and the Impact page** are checked at
  publish (M11).

**Images.** Alt text is required from submission onwards (stories,
projects, team).

**Settings.** Site settings keep their M5 rule. Only owners save them
(`settings:write`), and an owner's website publish takes the saved settings.
They are the site's configuration rather than editorial content, and the
only people who change them are the people who approve, so a review step
would add nothing. Approval for settings would be a separate decision.

**Archiving** stays open to editors (`content:delete`). It takes effect at
the next website publish.

**Two kinds of approval.** The release approvals in `apps/web` (the
`approved` flags of the website's own source records, and the verification
of figures) are an organizational sign-off on the site's built-in content.
Editorial approval is the CMS workflow above. The two are separate and never
read each other.

**Admin.**
- **Badges:** Draft, Needs review, Approved, Published and Archived. A
  record on the website with pending changes reads "Published · changes
  pending approval" (or "· changes approved").
- **The Review panel** in every editor states what the website shows. It
  offers only the moves this member may make: Submit for review, Withdraw,
  Approve and Return to draft. Approve and Return to draft are confirmed in
  a dialog. A submitted record's form is read-only.
- **The publish panel** lists what is approved, what waits for review and
  what blocks the publish. Publishing sends the reviewed `changesKey`.
- **Lists** filter by every state. There are no bulk actions.

**Proof.** Run against a local MongoDB with the website built from the
snapshot. For a story and the homepage: edit, submit, reject, resubmit
and approve leave the public snapshot and the built website byte-identical.
Only the owner's publish replaces them, atomically, and the previous
version stays intact. Stale edits, approvals and publishes get 409.

## Impact stories and scheduled publishing (M15)

### Impact → Stories: one story world at a time

**When stories are CMS-managed.** The rule M6/M12 set for every
collection: stories are CMS-managed once the snapshot carries
`content.stories`, which happens when at least one CMS story is PUBLISHED.
No new flag is stored. The website's adapter sets
`STORY_SOURCE = { cms: true }` alongside `STORIES`.

| | Stories are the website's own | Stories are CMS-managed |
|---|---|---|
| `/stories`, story pages, related stories | the source stories | the published CMS stories only |
| the website's own Impact page (no CMS Impact page) | its `IMPACT.stories` slugs, resolved against the source stories (unchanged) | **no stories**: the chapter's empty state, and a loud build warning. Its slugs are never resolved against CMS stories |
| a CMS Impact page (`storyIds`) | names the website's own stories by id (the API checks nothing it does not manage; the build resolves them, and a missing one fails it) | names CMS stories by id |

**What is refused, and where.** Nothing falls back to a source story, and
nothing is silently left out. Each of these is refused at every stage:
- a story that does not exist in this organization
- another organization's story
- an archived story
- a story that is not public-ready: draft or submitted, unless it is live
  in an earlier version

| Stage | What is checked |
|---|---|
| save | that the story exists and is not archived (`referenceProblems`, once the organization has a CMS story) |
| submit | the same |
| approve | the story is approved, published or live |
| website publish | the snapshot contract: every story the Impact page names is in the same snapshot |
| build | the snapshot contract, and `CmsImpact` throws for a story that is missing or not shown |

**Moving to CMS stories.** An Impact page published while the website's
stories were the stories names website-story ids. When the first CMS
story is published, that publish is refused until the Impact page names
CMS stories. The publish panel lists it as a blocker.

### Scheduled publishing

**The model: approved + a schedule.** There is no new workflow state.
Scheduling never approves:

```
draft → submitted → approved ──(schedule: owner)──▶ approved + schedule ──(its time, then a publish)──▶ published
```

**Where the schedule lives.** Beside the record, as storage metadata
(content-schema `PublicationSchedule`). It is never part of a record and
never in a snapshot:

| Field | Meaning |
|---|---|
| `at` | the UTC instant |
| `timeZone` | the IANA zone it was chosen in |
| `revision` | the revision it was set at |
| `fingerprint` | a hash of the approved content (without `status`, `publishedAt`, `updatedAt` and `order`) |
| `by`, `createdAt` | who set it, and when |
| `failedAt` and `problems` | set if the publication was refused |

**What can be scheduled.** Every type with the editorial workflow:
- **collection records**, each with its own schedule
- **single pages** (homepage, About, Impact, Transparency, Careers, the
  donation page, each policy and each Get Involved page), as a whole
  revision

Site settings are not scheduled (M14 decision). There are no bulk
actions.

**API.** Owners only (`publish:execute`), after authentication, CSRF and
the organization check:

| Route | Body |
|---|---|
| `POST /api/v1/<collection>/:id/schedule` and `POST /api/v1/<page>/schedule` | `{ revision, localTime: "2026-10-15T10:00", timeZone: "Asia/Kolkata" }` |
| `.../unschedule` | `{ revision }` |

- A stale revision → 409.
- Not approved → 409: draft, submitted, rejected (draft), archived and
  published are all refused.
- Validated in full, as on approval.
- A new schedule replaces an earlier one.
- Both run under the publish lock, so they never interleave with a
  publication: during one, they get 409 "A website publication is in
  progress".

**Time.** The owner gives a wall-clock time and an IANA zone, and the API
stores one UTC instant (`zonedTimeToInstant`). Refused (400):
- a time in the past, or more than 366 days ahead
- an unknown zone, an abbreviation (IST, EST) or a POSIX name
- a time the clocks skip (daylight saving) — never moved
- a time that happens twice — never guessed

The admin shows "Scheduled for Oct 15, 2026 · 10:00 AM Asia/Kolkata",
always in the schedule's own zone. The browser's and the server's zones
are never used.

**Exact revision.** A schedule stands only on the content it was set on:
- **Any write that leaves the record not approved** drops it: an edit (back
  to draft, M14), a return to draft, an archive. Each drop is audited as
  `<kind>.unscheduled` with a reason.
- **Reordering** (no content change) keeps it.
- **At publish time** the fingerprint is checked again. A mismatch refuses
  the publish (a blocker), so an unapproved edit can never go out under an
  old schedule.

**What a publish takes now** (owner or scheduler alike, one pipeline):
- approved revisions without a schedule
- approved revisions whose schedule is due
- never a schedule that is not due: that record is held back like an
  unapproved edit, and its live version, if any, stays

What would be published changes when a schedule comes due, and so does the
`changesKey`.

**The scheduler.** One central run for every content type, with no
per-type cron and no in-process timer: `PublishService.runScheduled`.
- **Triggered from outside:**
  - **Vercel Cron**, calling `GET /api/v1/internal/scheduler/run` with
    `Authorization: Bearer <CRON_SECRET>`
  - **any other cron**, doing the same
  - **`pnpm api:scheduler:run`**, the same route in-process
- **Each run, under the publish lock:**
  1. finish a publish that stopped after the public pointer moved: mark
     what went live, trigger the deployment, audit `publish.completed`
     with trigger "recovery" — once
  2. retry a failed deployment trigger, up to 3 attempts per version
     (`publish.redeployed`)
  3. if an approved schedule is due and has not failed, publish the
     website (trigger "schedule", actor null, published by "Scheduled
     publication")
- **Outcomes:** `idle`, `busy`, `published`, `already-published`,
  `recovered`, `redeployed`, `failed`.
- **The route itself:**
  - Without `CRON_SECRET` it answers 503, and with a wrong or missing
    secret 401. A session is never enough.
  - The secret is compared in constant time and never logged.
  - It is GET only (Vercel Cron's method), with no body, nothing from the
    caller but the secret.

**Idempotency and races.** One lock (`publish_state`, a lease) serialises
publishes, scheduler runs, schedules and unschedules across instances.
| Situation | Result |
|---|---|
| Two runs at once | one publishes, the other is `busy` (or finds nothing) |
| A second run | nothing is due any more: the first marked what it took, approved → published, schedule dropped |
| A run against an owner's publish | one publication; the other is refused (409 / `busy`), or finds nothing new |
| A run against an unschedule | the unschedule happens before the run (nothing published) or after it (published; 409 "not scheduled"), never between |
| A run against an edit | the edit drops the schedule (not published), or the run publishes the approved revision first |

There is never a duplicate snapshot, deployment trigger or success audit.

**Failure and retry.**
- **A refused scheduled publication** (validation, a Givebutter check):
  - the live snapshot stays
  - `publish.rejected` is audited (trigger "schedule") once
  - the due schedules are marked failed ("Schedule failed" in the admin,
    with the reasons)
  - the scheduler does not retry them by itself (no failure every run): an
    owner fixes what is reported and reschedules, unschedules, or publishes
- **A deployment trigger that fails:** the snapshot is live and is never
  re-created. Its state is kept on the active version
  (`pending` → `triggered` / `not-configured` / `failed`, with attempts).
  The scheduler retries it, up to 3 attempts in all.
- **A run that stopped part-way:** the next run finishes it (step 1 above).

**Manual publishing.** An owner's publish:
- takes everything approved and due, including due schedules the scheduler
  has not reached yet
- leaves not-yet-due schedules queued
- is the publish behind "Publish now" in the editor

A scheduled publication is a website publish: it also takes whatever else
is approved and unscheduled at that moment, and the saved settings, as any
publish does.

**Audit:**
- `<kind>.scheduled` with `{ revision, at, timeZone, previousAt? }`
- `<kind>.unscheduled` with `{ revision, at, reason: owner | edited | rejected | archived }`
- `publish.completed` with `trigger: manual | schedule | recovery` and the
  scheduled items it took
- `publish.rejected` with its trigger
- `publish.redeployed`

Never content wording or secrets.

**Admin:**
- **Badges:** Draft, Needs review, Approved, Scheduled (its own badge,
  never Published), Published, "Published · changes pending approval",
  "Published · changes scheduled", Schedule failed, Archived.
- **Owners** see Publish now, Schedule, Unschedule and Reschedule, each
  confirmed in a dialog.
- **The schedule dialog** asks for a date, a time and a time zone. The zone
  is never defaulted to the browser's; the last one used is remembered on
  that device.
- **Editors** see the schedule and no scheduling controls.
- **The publish panel** shows NOW (approved, goes live next), SCHEDULED
  (time and zone, failures marked), WAITING (submitted) and BLOCKED, with
  true counts, plus a failed deployment.

**Public site.** It is unaware of scheduling: no runtime calls and no
route changes. A scheduled revision is not in any snapshot, so it is not
built, prerendered or indexed before its publication; after it, it follows
the published snapshot like anything else. Before the first CMS
publication, and while a CMS revision is only scheduled, the source content
stays the source.

**Proof.** Run against a local MongoDB, in real time, with the scheduler
run through its CLI:
- Story B and a scheduled homepage revision stayed off the snapshot and
  the built website until their minute.
- A run before the time did nothing.
- At the time, one new version took both.
- A second run was a no-op.
- Stale schedule changes got 409, and an editor got 403.
- A four-way race (owner publish, unschedule, two runs) produced exactly
  one publication, and an unschedule never coincided with publication.

## Media still in use (M16)

A ready image can't be deleted from the media library while any of these
uses it:
- the live snapshot;
- the saved site settings;
- an approved, scheduled or published record or page.

The API answers `409` and lists where the image is used. The check runs
under the publish lock, so it never races a publication or a scheduler run.

Drafts don't hold an image. A draft whose image was deleted can't be
submitted or approved until it picks another, so the website never
references a deleted file.

Details are in [MEDIA_LIBRARY.md](MEDIA_LIBRARY.md#what-deletion-refuses-m16).

## Sharing metadata (Milestone 3)

Every content type with SEO overrides (`SeoOverrides`: `title`,
`description`, `ogImageId`, `noIndex`) treats them the same way — news,
blogs, events, stories, projects, programs, appeals, the donation page, the
homepage, About and Impact; Careers has `title`, `description` and `noIndex`
(its contract has no share image, and one is refused, not dropped).

- **Editing:** every editor has the four fields (Careers three), "Keep out
  of search engines" included. `seo` is one field: an update without it
  keeps it, `seo: null` clears it, and `seo: { … }` replaces it whole (the
  admin always sends all of it). The admin stores `noIndex` only when true.
- **Validation:** the share image must be a ready image of the organization's
  media library (at save); `noIndex` is a boolean; unknown keys are refused.
- **Snapshot:** records carry their `seo` as stored; the share image is
  published with them. The site-wide default share image is
  `settings.seo.ogImageId`.
- **Website — the share image of a page**, in order: its own SEO image; else
  the image the page already uses as its own (a story's, a project's, an
  article's, an event's, a person's); else the site-wide default
  (`SITE.shareImage`); else none. A share image appears only on a page that
  is indexed (and only as an absolute URL) — never a placeholder.
- **Website — `noIndex`:** true takes the page out of the index (and with it
  its canonical, share image and structured data); false or absent changes
  nothing. It never adds a page to the index: news, blog, event and appeal
  pages stay unindexed, as before — there is no indexing policy for them.

## News, blog and event fields (Milestone 4)

- **News — program area** (`programId`): a program's slug, optional. Checked
  at save like a story's program: this organization's, not archived, and
  approved or live by the time the item is approved (while no program is
  managed in the CMS, the website's own program is named by its address and
  the website build checks it). Absent: no program label, as before. A news
  item has no `category` — it is refused.
- **Blog — category** (`category`): one of `BLOG_CATEGORY_IDS`
  (`reflections`, `field-notes`, `how-to` — the website's
  `BLOG_CATEGORIES`), optional. Absent: listed under "All" only, as before.
  A blog post has no `programId` — it is refused. Changing a post's type
  means clearing the other type's field in the same save (the admin does).
  The snapshot refuses a blog category outside the list.
- **Event — program area** (`programId`): a program's slug, or `null` for
  an event open to all; clearing it (`null`) makes the event open to all.
  Checked like a news item's.
- **Event — schedule** (`schedule`): up to 20 steps `{ time?, item }`; a
  timed step falls within the event (not before the start, not after the
  end) and timed steps run in order; clearing it (`null`) leaves no
  schedule (`[]`), and the page shows no schedule section.
- **Event — time zone.** An event's date, start, end and schedule times are
  wall-clock values on its own day, stored and published exactly as
  written, and never converted (not to UTC, the reader's zone or the
  server's). `timezone` names the IANA zone they are in; the website shows
  it beside the times on the event page. The CMS requires one and never
  infers it: the editor chooses it (any IANA name the runtime knows, older
  spellings included — `Asia/Kolkata` and `Asia/Calcutta`; abbreviations
  such as `IST` are refused). A start that a daylight-saving change skips in
  that zone is refused, never moved; a start in an hour that happens twice
  is kept as written. The website's own source events state no zone and
  show their times as written; migrating them waits on RBB naming the zone
  (the rehearsal reports each as blocked on `timezone`, and on nothing
  else).
- **Every update:** a field left out is kept; `null` clears it as above.
  Records saved before these fields existed carry none of them and render
  as they always have.

## Story quotes and impact (Milestone 5)

The two story fields the website's story template already drew, now in
the CMS — stories only (news and blog posts have neither; `/api/v1/posts`
refuses them, and the snapshot refuses them on a news or blog post).

- **Quotes** (`quotes`): up to 6, each `{ text, attribution }` — the words
  as said (up to 600 characters) and who said them (up to 160). Both are
  required, as the website's own content rules require
  (`content/validate.js`, `docs/CONTENT_GUIDE.md`). Shown after the story
  as pull-quotes, in order. Public as written. A real person's words need
  RBB's approval and their permission: the editorial approval is that gate;
  the CMS records no consent for a quote.
- **Impact** (`impact`): up to 12 plain lines (up to 200 characters each) —
  the change the story documents, shown as written in its "Impact" row.
- **Both:** a list of at least one, or absent; each quote's words and each
  line distinct (the page tells them apart by their text); plain text only.
  An update without them keeps them; a list replaces the whole list; `null`
  clears it (the admin clears an emptied list). Stories saved before
  Milestone 5 have neither and render as before.
- **Listings** — the stories hub, the homepage, /impact and related-story
  cards — draw neither: a card is the same with or without them.
- **Private stays private:** an image's credit, licence and consent are
  never published (Milestone 2); a quote carries nothing but its words and
  attribution.

## Project fields (Milestone 6)

The fields the project template already drew (`pages/ProjectDetail`), now
in the CMS. Each is optional and shows only when present; projects saved
before Milestone 6 have none and render as before. An update without one
keeps it, a list replaces the whole list, `null` clears it.

- **Location** (`location`, up to 120): "Location" in the project's facts.
- **Stage** (`stage`, up to 60): "Status" in the facts — the project's own
  stage as RBB states it. The source calls it `status`; the contract calls
  it `stage` because a record's `status` is its editorial status. The
  website receives it as `status`, as before.
- **Date** (`date`, YYYY-MM-DD): the project's date on the homepage's
  project timeline (newest first; the card shows the date, else the stage).
  One date — the source has no range. Not shown on the project page.
- **Impact** (`impact`, 1–8 of `{ value, label }`): "Impact", each as
  "value — label". Results RBB has verified, never aims (aims are
  `outcomes`); the owner's approval is the verification — there is no
  separate verified flag.
- **Partners** (`partners`, 1–12 names): "Partners", one per line.
- **Story** (`storyId`): "Story", with the story's own title and excerpt
  (never a copy). Named by id, as the Impact page names stories: one of this
  organization's stories (not archived; approved by the time the project
  is — or, when the story names this project back, in review with it), or,
  while the organization has no CMS story, one of the website's own by its
  id. The publish refuses a project whose story it does not carry (once it
  carries stories); the website build fails on a story the site does not
  show (`lib/projectStory.js`, `content/validate.js`). The row shows the
  title and excerpt as text, as the template always did — not a link.

## Donation page and appeal sections (Milestone 7)

The general donation page (/appeals) and every appeal draw the same
donation experience; their `sections` now carry everything it draws. The
form slot (the site's form, or a verified Givebutter checkout) is
unchanged.

- **"Why it matters"** — one passage: a statement (`kicker`, `heading`,
  `highlight`, paragraphs, `cta`) or formatted text (`heading`, rich
  text). The admin edits a statement as a statement (it no longer turns it
  into formatted text on save). Its kicker falls back to the page's old
  one ("Why give"; an appeal's kind).
- **"How your support helps"** — numbered cards with `kicker` (fallback
  "How support helps"), `highlight` and `intro`.
- **Appeal lists** (`appealList`, up to 3) — each the published appeals of
  one kind, or all; on an appeal page never the appeal itself. Present,
  they replace the page's built-in appeal bands (the hub's Emergency
  Response and Campaigns bands; an appeal's "Other appeals").
- **Trust panel** (`trust`, one) — the page's own kicker, heading,
  highlight, text and link; the documents beneath it stay the
  transparency records'.
- **Questions** (`faq`, one) — the page's own heading and questions.
- **Three states** for the trust panel, questions and appeal lists: none in
  the record → the site's own, exactly as before (the transparency panel;
  the donation questions on /appeals, none on an appeal; the built-in
  bands); in the record but switched off (`enabled: false`) → none on this
  page; in the record and on → the page's own.
- **Appeals published from the CMS** use their own statement heading and
  kicker. The website's own sample appeals keep the page's wording ("Why
  this response matters"), as before. "Support <title>" stays the page
  title for every appeal: it is the page's wording around the CMS title,
  not a field.
- **Validation:** the contract's block rules; one passage, one list of how
  support helps, one trust panel, one FAQ, at most three appeal lists;
  `imageText` and `stats` are still refused (the donation page does not
  draw them). A release marker anywhere in a section is refused at save
  and by the snapshot (the source's sample FAQ answers carry one).
- **Updates:** `sections` is one field: left out, kept; sent, replaced as a
  whole. Pages and appeals saved before Milestone 7 render as before.
- **Not applied (payment-adjacent, left for a decision):** `designation`
  and `formOverrides` (stored, not used by the form), the settings'
  `donations` defaults, and an appeal's `startsOn` / `endsOn`.

## Homepage and About fields (Milestone 8)

Fields the contract always held, now drawn by the website and offered by
the admin. Each is optional; without it the band is exactly as before.

- **Homepage:** "programs" and "get involved" — a line under the heading
  (`body`) and a link button (`cta`); "timeline" and "stories" — a line
  under the heading (`body`; their link was already drawn); "approach" and
  an appeal list — the heading's `highlight`.
- **About:** "who we are" (statement) — a link button (`cta`); mission and
  vision — the heading's `highlight`; the values (numbered cards) — a line
  under the heading (`intro`); "how we work" (approach) — the heading's
  `highlight`.
- **Stored but intentionally not drawn:** "get involved" `imageIds` (the
  band draws the ways in as icon boxes, never photographs) and the closing
  call to action's `imageId` / `cardImageId` (the homepage's closing band
  draws no photograph; the source homepage holds both and shows neither).
  The admin does not offer them.
- **Not fields:** the hero's kicker (the brand's name), the slideshow and
  play labels, the approach steps and the Get Involved cards are the
  website's own.

## Failure behaviour

| Situation | Result |
|---|---|
| No `RBB_SNAPSHOT_URL` | Source content. The status is in `build-meta/published-snapshot-status.json` |
| Nothing published yet (404), or the API unreachable | Source content with a **loud warning**, or a failed build with `RBB_SNAPSHOT_REQUIRED=1` |
| Malformed snapshot, another organization, older than announced | **Build fails** (never half-used) |
| Snapshot fails the content contract (checked in the server build) | **Build fails** at prerender |
| Settings make a page break the site's own content rules | **Build fails** (existing validation) |

A snapshot from an earlier build is deleted at the start of every build.
`build-meta/published-snapshot-report.json` records which source a build
used.
