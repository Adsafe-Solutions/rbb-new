# Content migration rehearsal

> **Retired (2026-10-13).** The content is in the CMS and the website no
> longer keeps its built-in copy, so this rehearsal — `scripts/migration*`,
> its tests and the contract importers it used — was removed. This page is
> kept as the record of how the migration was rehearsed. See
> docs/PUBLISHING.md "No built-in content".

A **dry run** of moving the website's source content (`apps/web/src/content`)
into the CMS. It plans and never writes: there is no apply, write, upload or
publish mode, and the command refuses any such flag before it reads anything.

```sh
# Offline: plan from the source alone (nothing is read from any database)
node apps/web/scripts/migration-rehearsal.mjs --out=/tmp/rbb-manifest.json

# Match against what already exists — READ-ONLY:
node apps/web/scripts/migration-rehearsal.mjs --existing=test --out=…        # MONGODB_TEST_URI + MONGODB_TEST_DB (…_test), --org (default test-org)
node apps/web/scripts/migration-rehearsal.mjs --existing=production --out=…  # apps/api/.env.local: must load as the production target
node apps/web/scripts/migration-rehearsal.mjs --existing=file:existing.json --out=…
```

Without `--out` only the summary is printed. The manifest is deterministic: the
same source and the same existing records give the same file, byte for byte.

## How it works

| Part | File | Does |
|---|---|---|
| Source | `scripts/migration/source.mjs` | Loads the content through Vite's SSR loader **without** the published snapshot (the source site) and converts it with the build's own importers (`src/contract/importers.js`). Reads each image file (size, SHA-256). |
| Rules | `scripts/migration/rules.mjs` | What the CMS accepts, imported from the API itself: each collection's editable fields, required fields, defaults and contract; the page contracts; the donation page's drawn section types. |
| Existing | `scripts/migration/existing.mjs` | Optional, read-only lookup by organization-scoped slug. The target is identified **before** connecting (Phase 0 `config/target.ts`: production needs `RBB_TARGET=production` + `ORGANIZATION_ID=rbb`; test needs a `_test` database) and confirmed after (the database exists; production holds the organization's settings). Uses `find()`/`countDocuments()` only. |
| Planner | `scripts/migration/plan.mjs` | Pure: source + existing + rules → manifest. |

## The manifest

- `existing` — whether existing records were checked, and where (`none` means
  every `create` is conditional on nothing with that key existing).
- `records[]`, in dependency order (programs, figures, projects, team, stories,
  news, blogs, events, reports, appeals, then settings and pages), each with:
  - `key` — `<type>:<slug>` (pages: `<type>:<id>`), the stable identifier.
    The CMS assigns new ids, so every reference is symbolic: `@program:<slug>`,
    `@story:<slug>`, `@media:<registry key>`.
  - `action` — `create`, `exists-same`, `exists-differs` (reported, never
    changed), `needs-decision` (sample content), `blocked`.
  - `releaseMarker` — kept, although the CMS refuses it.
  - `withheld[]` — every source field that would not reach the CMS, with its
    reason and decision. Nothing is dropped silently: a source field the
    rehearsal does not know is listed as unmapped.
  - `references[]`, `blockers[]`, `existing` (id, status, revision, differing
    fields), `payload` — what the API would be sent.
- `media[]` — one upload per registry image a planned record uses: file, bytes,
  SHA-256, alt text, what is withheld (focal points), and `possible-existing`
  when a library item has the same file name and size.
- `cmsOnly[]` — records the CMS has that the source does not. They stay, and
  they count: a published collection replaces the website's whole list.
- `decisions[]` and `notMapped[]` — what needs schema work or a policy decision.

### Get Involved (Milestone 9)

`apps/web/scripts/migration/getInvolved.mjs` converts the hub and the four
paths (`src/content/getInvolved.js`) into the five records the contract
defines (`GetInvolvedHub`, `GetInvolvedPath`) — a pure, deterministic
function, the inverse of what the website does with a published page
(`snapshot-adapter.mjs getInvolvedFrom`). The manifest lists them after the
pages as `get_involved:<id>` (hub, volunteer, fellowship, partner, travel).

- **Carried:** the hub's heading, introduction, both path headings and its
  closing (each call to action by its target); each path's short
  description, hub note, sections in order (paragraphs and lists), question
  rows (as its FAQ) and meta description.
- **The website's, by design (noted, not withheld):** a path's title,
  button label, route, icon, `featured`, form and status; the hub's kicker,
  related and questions panels, pending line and link prefix; "Why get
  involved", which is the About page's mission statement (left out of the
  record so the page keeps it, one statement in one place). Sections hidden
  while empty draw nothing and are left out, with a note.
- **Withheld, making the page ineligible:** a row that shows its pending
  line (a CMS section needs words), questions beside other words, a second
  set of questions, an address that is not the page's, a link that is not
  a call-to-action target, an unknown key, and any release marker
  (`sample-content` — the marker stays in the manifest, never stripped).
- **Existing records** (`get_involved_pages`, by page id) are compared and
  reported `exists-same` / `exists-differs`, never overwritten; two sources
  for one page are both `blocked`.
- **Offline only:** the test-only writer does not write `get_involved`
  records (it reports them as a type it does not write).

A converted page, published, draws its page exactly as the website does
today — the five routes render byte for byte the same
(`scripts/test/get-involved-converter.test.mjs`).

## The test-only writer

`apps/api/test/support/migration-writer.ts` replays a manifest's eligible
records into the **reserved test database only**, as drafts, through the API's
own services (validation, reference checks, audit — never raw documents):

```sh
MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test \
  node apps/api/test/support/migration-writer.ts --manifest=<manifest.json> --report=<ledger.json> [--snapshot=<preview.json>]
```

- **Target:** exactly `risingbeyondborders_test` and the organization
  `test-org`, by name before connecting; confirmed read-only after connecting
  (the database exists and holds reserved test organizations' records only).
  There is no option for either name. Any other option — `--confirm`,
  `--production…`, `--org`, `--database`, `--apply`, `--publish` — is refused
  before the manifest is read or anything connects.
- **Eligible:** `action: "create"`, no release marker, no blocker, nothing
  withheld, no outstanding decision, and a type the writer writes (programs,
  figures, reports, projects, team, stories, news, blogs, events; settings,
  About, Impact, Transparency, Careers). Everything else is skipped with its
  reason. Sample content stays in the website's code.
- **Drafts only.** Nothing is submitted, approved, published, scheduled or
  activated.
- **References:** `@program:`/`@project:` become slugs and `@story:` ids, of
  records created in this run or already in the test organization. A record
  the manifest keeps in the website's code is named as the website names it
  while the CMS has none of that collection (the Impact page's stories). A
  reference nothing satisfies skips the record.
- **Media:** uploaded through the API's media service to a local **fake R2**
  only (in memory: objects do not outlive the run); an existing library item
  with the same file name and size is reused; a file whose SHA-256 no longer
  matches the manifest is not uploaded.
- **Never overwrites; rerun-safe; interruption-safe.** Records are found by
  key before any create; an existing one is reported with its differences and
  left alone. The ledger (`--report`) is written after every create and lists
  every id this rehearsal created, across runs, with how each reference was
  resolved — the only list a cleanup of the rehearsal may use. A rerun with the
  same ledger creates nothing that is already there.
- **`--snapshot`:** reads the drafts back, replays them into the in-memory test
  harness, approves them THERE, and writes the API's own publish preview as
  `{ data }`. Nothing is stored or activated anywhere.

Note: the integration tests and the smoke runners clean the reserved test
organizations, `test-org` included, before and after they run — that removes
a rehearsal's drafts too.

## Comparing the rendered site

1. Plan against the test organization: `--existing=test --org=test-org`.
2. Run the writer with `--snapshot`.
3. In two fresh scratch copies of `apps/web` without env files, build the
   source site, and the site from the preview snapshot served on localhost
   (`RBB_SNAPSHOT_URL=http://localhost:<port>/… RBB_SNAPSHOT_REQUIRED=1`).
   The website accepts only its own organization's snapshot (`rbb`), so the
   scratch copy of the preview is relabelled from `test-org` to `rbb` — its
   `organization.id` and the records' `orgId`, nothing else.
4. Compare every pre-rendered page with asset hashes normalized. Every
   difference must be one the manifest predicted.
5. Production is never seeded, cleaned or written.
