# @rbb/content-schema

The content contract between the future CMS/API and the public web. It
defines **what an editor stores**: plain JSON records validated by Zod
schemas. TypeScript types are inferred from the schemas (`type Appeal =
z.infer<typeof Appeal>`), never written separately.

The package is source-first TypeScript (`exports: ./src/index.ts`). Vite and
Node ≥ 22.18 load it directly, so there is no build step. It has no React and
no browser APIs, and Zod is its only dependency.

```sh
pnpm schema:test        # contract tests
pnpm schema:typecheck
```

## The rule

A record describes **data**, never presentation. Layout, colour tone, type,
spacing, motion, section numbering and responsive behaviour belong to the
web's components. No record carries a component name, class, style, HTML
or script, and every object is strict, so an unknown key is refused.

## Common fields (`recordFields`)

| Field | |
|---|---|
| `id` | Stable identity: letters, digits, `-`, `_`. Never a list position |
| `orgId` | The owning organization. Set by the API from the deployment, never by editors |
| `schemaVersion` | `1`. The contract version the record was written against |
| `status` | `draft` · `submitted` · `approved` · `published` · `archived` (M14). Only `published` is public, and a snapshot holds nothing else |
| `createdAt` `updatedAt` `publishedAt` | ISO instants, set by the API (absent in source content) |
| `releaseMarker` | Internal. Marks sample or working content (see below) |

`slug` (lowercase, hyphenated) is on routed records only. Revision counters
and audit history are storage concerns for the API, not part of a record.

## Status and release safety

Three questions that the contract keeps separate:

| Question | Answered by |
|---|---|
| Is the record live? (editorial lifecycle) | `status`: the CMS's editorial workflow (M14), `submitted` and `approved` being its review states. See docs/PUBLISHING.md |
| Is it still sample content? | `releaseMarker`, read by the web's release scans |
| Has the organization approved the subject for release? | `apps/web/release/approvals.mjs`, never a record field |
| Is a figure verified? | `Metric.verification` |

The web's legacy editorial statuses map to the lifecycle as follows
(`apps/web/src/contract/importers.js`):

| Legacy | Lifecycle |
|---|---|
| `approved`, `verified` | `published` |
| `placeholder` | `published` (it renders today; its `releaseMarker` keeps the release blocked) |
| `draft`, `pending-review` | `draft` |
| `archived` | `archived` |

The web's legacy `approved` is the organization's release sign-off for its
own built-in content. It is a different thing from the CMS's editorial
`approved`: an owner's approval of a revision for the next website publish.
The importers never produce `submitted` or `approved`.

Scheduled publishing (M15) adds no status. An approved record may carry a
`PublicationSchedule` (`common/schedule.ts`): a UTC instant, the IANA zone
it was chosen in, and a fingerprint of the approved content. It lives
beside the record in storage, never in a record or a snapshot.
`zonedTimeToInstant` turns a wall-clock time in a zone into that instant,
and refuses a time daylight saving skips or repeats.

Indexing still follows the approvals and the absence of sample content, so
`seo.noIndex` can take a page out of the index but can never force one in.

## Entities

| Schema | What | Today's source |
|---|---|---|
| `Appeal` | Emergency appeal or campaign: `kind`, `title`, `summary`, `imageId`, `highlight?`, `sections`, `donation?` | `content/appeals.js` — **authored as records** |
| `GeneralDonationPage` | `/appeals` singleton: `hero`, `sections`, `donation.designation` | `content/donation.js` |
| `Post` | `type: story · news · blog`, rich-text `body`, category, related posts; a story's `quotes` ({ text, attribution }) and `impact` (lines) | `content/stories.js`, `content/media.js` |
| `Event` | Date, `startTime`/`endTime` ("6:30 PM", wall-clock, never converted), `timezone` (IANA; required by the CMS, never inferred), venue, schedule (timed steps within the event, in order), `programId` (null = open to all) | `content/media.js` EVENTS |
| `Announcement` | One bar message: `text`, `link?`, `order` | `content/announcements.js` bar |
| `Popup` | `key` (the "closed" memory), heading, `highlight`, CTA, delay, frequency, `excludePaths` | `content/announcements.js` popup |
| `Homepage` | Singleton: an ordered list of blocks (below) | `content/homepage.js` |
| `Metric` | One headline figure + `verification` | `content/impact.js` metrics |
| `Media` | Image or document: `alt` (required unless `decorative`), `focal`, future storage and provenance fields | `content/photos.js` |
| `SiteSettings` | General, contact, social, SEO defaults, branding, analytics IDs, donation defaults, engagement toggles, features | `brand.js`, `contact.js`, `donation.js`, `announcements.js`, env flags |

Future fields are optional and marked in the schema. No current record uses
them yet: `Appeal.startsOn/endsOn`, `Event.timezone/registrationUrl` (the CMS requires
`timezone` on every event it saves — Milestone 4),
`Announcement/Popup.startsAt/endsAt`, `Popup.includePaths`, the storage
fields on `Media`, and `SiteSettings.branding`.

## Section blocks

`sections` is an ordered list. Each entry has the shape
`{ id, type, enabled, version: 1, data }`:
- `id` is stable across reordering, so it survives edits and migrations.
- `version` is the block's data-schema version, so a block type can evolve.
- An unknown `type` is refused. There is no generic, HTML or component block.

| Block | Data | Web component | Allowed on |
|---|---|---|---|
| `statement` | heading, paragraphs, cta? | DonationExperience *Why*, StatementSplit | appeal, generalDonation, page |
| `richText` | heading, rich text | ContentRows | appeal, generalDonation, page |
| `numberedCards` | heading, intro?, items {title, description?} | DonationExperience *Impact* | appeal, generalDonation, page |
| `imageText` | heading, paragraphs, `imageId`, `imagePosition`, ctas | EditorialSplit | appeal, generalDonation, page |
| `stats` | heading, `metricIds` (never inline figures) | ImpactStats | appeal, generalDonation, page |
| `faq` | heading, items {question, answer} | Faq | appeal, generalDonation, page |
| `cta` | heading, primary/secondary link, imageId? | CtaSection, ClosingCta | page |
| `trust` | heading, body, cta | TrustPanel | appeal, generalDonation, page |
| `appealList` | heading, `kind?` | AppealGrid | appeal, generalDonation, page |

Every headed block takes an optional `highlight`: the word or phrase of the
heading set on a highlight block. It must appear in the heading.

`page` is the future generic page. Donation pages leave out `cta` because
their closing band is the application's own "back to the form" action.

**The donation form is never a block.** Every donation page draws the
application's one form. Content only configures it: `SiteSettings.donations.form`
holds the defaults, and `Appeal.donation.formOverrides` holds per-page
changes. `resolveDonationForm()` merges the two, and the merged result must
still be a valid `DonationFormConfig`.

**The homepage is an ordered list of blocks (M8).** M1 modelled it as named
slots in a fixed order. M8 needs editors to add, reorder and hide blocks, so
each slot became a block type in the shared envelope
(`{ id, type, enabled, version, data }`), keeping its M1 data shape exactly:
`hero`, `imageText` (who we are), `programs`, `approach`, `stats` (impact),
`timeline`, `stories`, `video`, `trust` (transparency), `getInvolved`, `faq`
and `cta` (the final ask).

Three blocks reference other records by id instead of copying them:
- `appealList`: the shared block, plus optional `appealIds`
- `postList` and `eventList`: new in M8

The registry (`homepage/registry.ts`) holds editor names and the rules (the
hero comes first; single blocks appear once). It is plain data, so the admin
imports it as `@rbb/content-schema/homepage-registry` without the schemas.
Blocks whose cards come from other records (programs, stories, Get Involved
paths) hold only their own heading.

A disabled block stays in the record but never enters a snapshot. A
snapshot's homepage may reference only posts, events and appeals published
in the same snapshot.

**The About page and the team (M9).**
- `About` is a block page like the homepage: an ordered list of its own
  chapters in the shared envelope, with its registry in
  `about/registry.ts` (also importable plain as
  `@rbb/content-schema/about-registry`).
- `TeamMember` is a content record: one person on the team page, with
  their profile. The `group` is `leadership` | `team`; there are no contact
  details.
- In a snapshot, `about` appears only while published, with enabled blocks
  only. `team` holds published members in order, and each member's
  photograph must have alt text.

**Programs (M10).**
- `Program` is a content record: one area of work, with its page's
  sections as plain text and an `icon` from `PROGRAM_ICONS` (the website's
  line glyphs).
- In a snapshot, `programs` appears only once a program is published, and
  holds published programs in order with unique ids and slugs.
- When the key is present, every `programId` in the snapshot (posts,
  events, homepage timeline items) must name one of them.

**Impact and transparency (M11).**
- `Metric` gains `slug` (the key `stats` blocks name it by) and `order`.
  In a snapshot, `metrics` appears once a figure is published; when it is
  present, every `stats` block must name a published figure.
- `Impact` is a block page (registry `impact/registry.ts`, also
  importable plain as `@rbb/content-schema/impact-registry`) of /impact's
  chapters. Figures, programs and stories are named, never copied.
- `Transparency` is one typed record: the chapter's words, a financial
  overview whose shares add up to 100 (shares, never amounts), optional
  governance, and "How we report".
- `Report` is a transparency document: a category, title, optional year
  and type, and an https `fileUrl` (the media library holds images only).

**Projects and stories (M12).**
- `Project` is an ordered record: a program's slug (never a copy of the
  program), a description, a photograph, its page's sections and SEO.
- Stories are `Post` records of type `story` (as M1 defined them), with a
  `category` from `STORY_CATEGORY_IDS`.
- In a snapshot, `projects` and `stories` appear once one is published:
  - a project names a published program
  - a story names published projects, programs and related stories
  - at most one story is featured
  - their images are described
  - the Impact page's `storyIds` name published stories

**Careers (M13).**
- `Careers` is one typed record: the Careers page's header, optional "Why
  work with us" and "How to apply" sections, "Open opportunities" with
  its roles (title only, in order), the closing ask, and SEO without a
  share image.
- In a snapshot it appears only while published.

## Media

Content points at images by `MediaId`, never by URL, path or import. Today
`apps/web/src/contract/media.js` resolves an id to the local photograph
(`working-relief-packing` → `WORKING_PHOTOS.reliefPacking`). Once media
moves to R2, the id stays and only the resolver changes.

## SEO

`seo?: { title?, description?, ogImageId?, noIndex? }` is on Appeal,
GeneralDonationPage, Post, Event, Homepage, About, Program and Impact.
Without it, values come from the record itself (title, excerpt or summary,
image), which is what the web does today. There is deliberately no
canonical override: canonicals derive from the route.
Site defaults live in `SiteSettings.seo`.

## Links and text

- `Link` is `{ label, href }`. `href` may be a site path (`/x`, `/x#y`),
  `#section`, `https://`, `mailto:` or `tel:`. Everything else is refused,
  including `javascript:`, `data:`, `vbscript:`, `http:` and `//host`.
- Plain-text fields reject anything that looks like an HTML tag.
- Long-form text is `RichText`, a restricted JSON tree:
  - block nodes: paragraph, heading (h2/h3), and list (bullet or ordered)
  - inline nodes: text (bold, italic) and link (safe `href` only)
  - no raw HTML, embeds or scripts

## Secrets

`SiteSettings` holds only public configuration. Database URIs, storage keys,
email and payment API keys, webhook and session secrets are never content:
they belong in each deployment's environment. Strict objects refuse a stray
secret field rather than storing it.

## How the web uses it (M1)

`apps/web/src/contract/` contains:

| File | Ships to browser | |
|---|---|---|
| `org.js` | yes | `ORG_ID` |
| `media.js` | yes | media id → local photograph |
| `appeals.js` | yes | `Appeal` record → the view model the components already read |
| `importers.js` | no (build) | today's content modules → records |
| `conformance.js` | no (build) | JSON round-trip, schema and reference checks on every record |

`content/validate.js` runs the conformance check on every production build
and in `validate:content`, and any error stops the build. Zod never reaches
the browser bundle.

**Migration path:**
1. `src/content/*.js` (today)
2. contract records (appeals done; everything else proven by the importers)
3. JSON snapshot
4. MongoDB → API → snapshot
5. admin → API → MongoDB
