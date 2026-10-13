# Admin implementation plan

What remains to build on the Admin (CMS) side, in the order it will be
done. Each item is implemented, tested with the unit suites
(`pnpm schema:test`, `pnpm api:test`, `pnpm admin:test`, `pnpm web:test`,
`pnpm typecheck`), reviewed, then committed. Nothing here touches
production data; deployment is a separate, explicit step.

Sources: `docs/CMS_COVERAGE_AUDIT.md`, `docs/CONTENT_MIGRATION_PLAN.md`,
and the problems met while entering content on 2026-10-12/13.

## Status

| # | Item | Size | Status |
|---|---|---|---|
| 1 | Remove stale "Not found" references from record pickers | S | Done — committed and pushed (`bb58fad`); live in the Admin (verified 2026-10-13) |
| 2 | Homepage timeline "Program" as a program dropdown | S | Done — committed and pushed (`bb58fad`); live in the Admin (verified 2026-10-13) |
| 3 | Refuse `[RBB to confirm: …]` placeholders in published text | S | Reversed (decision, 2026-10-13): placeholders must not block — rule removed; not yet tested, committed or deployed (the live API still has `bb58fad`'s rule) |
| 4 | Publish errors that say where to fix them | M | Done — committed and pushed (`9e3d230`); live in the Admin (verified 2026-10-13) |
| 5 | Our Approach block on the Impact page | M | Implemented — D11 decided (reuse the existing approved content; framework rejected and removed); not yet tested or committed |
| 6 | Where We Work (geography) block on the Impact page | M | Implemented with the D14 country selector — selection empty until RBB selects; not yet tested or committed |
| 7 | How We Work page editor | M | Implemented (structure) — not yet tested or committed; approved wording still required (D11) |
| 8 | Giving methods / legacy giving pages | M | D35 decided — the four unused legacy pages removed; no giving-methods model needed; not yet tested or committed |
| 9 | Settings → Branding applied on the website | L | Removed — not required (scope decision, 2026-10-13) |
| 10 | Settings → Analytics / Features editors | S–M | Removed — not required (scope decision, 2026-10-13) |
| 11 | Donation settings, appeal designation / form overrides / run dates applied | M | Deferred — Givebutter integration to be handled later |
| 12 | Contact method description editable | S | Done — committed and pushed (`13d0749`), tests verified; live in the Admin (verified 2026-10-13) |
| 13 | Pages (general page editor) | L | Removed — not required (scope decision, 2026-10-13) |
| 14 | Audit Log screen | M | Removed — not required (scope decision, 2026-10-13) |
| 15 | Settings → General: country selection | S | Implemented — not yet tested or committed |
| 16 | Website forms stored + Admin → Form submissions | M | Done — committed, pushed and live (`e77f3df`, replies `669f561`) |
| 17 | Form builder: edit every website form; career application forms with CV uploads | L | Implemented — tests run; not yet committed or deployed |

## 1. Remove stale references from record pickers — done

A page or block could name a record the CMS does not have (the Impact
page's Stories block kept the website's story ids `classroom-books`,
`sewing`); the picker showed "Not found, Not found" with no way to remove
them, and the website publish stayed blocked.

- `apps/admin/src/blocks/pickerChoices.ts` — `unlistedChoices`,
  `withoutChoice` (plain functions).
- `apps/admin/src/blocks/fields.tsx` `RecordPicker` — each chosen id not in
  the list is shown by its id with a **Remove** button; "Chosen but not
  approved yet" lists real records only. Every picker that uses it
  (Impact stories and figures, homepage appeals/posts/events, related
  stories) gains it.
- Tests: `apps/admin/scripts/test/record-picker.test.mjs` (4).

## 2. Homepage timeline "Program" as a dropdown — done

The Timeline block's Program was a free-text box wanting a program's
address; typing its name (`Health & Wellbeing`) was accepted by the box
and refused later.

- `apps/admin/src/homepage/BlockEditor.tsx` — the milestone's Program is
  the shared `ProgramSelect` (as projects, stories, posts and the Impact
  page use): the organization's programs by name, a stored unknown value
  shown as "not found", typing only while no program is managed.
- Tests: `apps/admin/scripts/test/timeline-program.test.mjs` (3).

## 3. Placeholders in published text — reversed

**Decision (2026-10-13): placeholder text must not block.** The live
publish panel was blocked by the drafted Privacy and Donation policies'
`[RBB to confirm: …]` placeholders. The "confirmation placeholder" rule is
removed from both lists (`packages/content-schema/src/common/workingText.ts`
and `apps/web/src/lib/releaseMarkers.js`, still in parity), so
`[RBB to confirm: …]`, `[to be confirmed]`, `[TBC]` and `[TODO …]` no longer
stop a save, submission, approval, publish or website build, and text with
them is published as written. The other working-text rules ("Demo —",
sample markers, example.org addresses …) are unchanged. Tests turned
around (not yet run): `apps/api/test/policy-working-text.test.ts`,
`apps/web/scripts/test/working-text-parity.test.mjs`. Unblocking the live
admin needs the API deployed (and the website, for its build check).

What item 3 originally did (now undone):


- New rule "confirmation placeholder" —
  `/\[(RBB to confirm|to be confirmed|TBC|TODO)\b[^\]]*\]/i` — in the
  website's list (`apps/web/src/lib/releaseMarkers.js` WORKING_MARKERS) and
  its contract mirror (`packages/content-schema/src/common/workingText.ts`),
  same position, kept equal by the parity test.
- Effect: policies refuse it at submit, approve, schedule and publish (a
  draft may hold it); Get Involved pages, the announcement bar and the popup
  refuse it at save, as they do all working text; the website build refuses
  a published policy, Get Involved page or bar/popup carrying it. An ordinary
  bracketed aside ("[see below]") is not affected.
- Tests: the parity test's shared samples; a new policy test (draft allowed,
  submit refused for `[RBB to confirm: …]` and `[TBC]`, an aside accepted,
  publish refused by name).

Original note: the working-text check stops "Demo —" wording but not the
`[RBB to confirm: …]` placeholders used in drafted policies, so
unfinished text could be approved. Add the bracketed placeholder pattern
to the shared working-text rules
(`packages/content-schema/src/common/workingText.ts` and its web mirror
`apps/web/src/lib/releaseMarkers.js`, kept in parity by the existing
parity test). Drafts may still hold it; submit, approve and publish refuse
it.

## 4. Publish errors that say where to fix them — done

- `apps/admin/src/settings/publishProblems.ts` — `describePublishProblem`
  turns the API's "<data path>: <message>" into where to fix it, a link and
  the message: `content.impact.sections.5…` → "Impact page · block 6"
  (/impact); `content.stories` → "Stories"; `content.policies.privacy` →
  "Policies · Privacy Policy" (/policies/privacy); `content.getInvolved.travel`
  → its page; `content.team.<address>` → "Team · <address>";
  `content.projects.2` → "Projects · item 3"; `schedule.<section>.<id>` → the
  record or page and "scheduled publication"; `settings.*` → Settings;
  `media.*` → Media library. Unknown paths show as before, without a link.
  `publishProblemLine` gives the same as one line of text.
- `apps/admin/src/settings/PublishProblemText.tsx` — renders it with an
  in-app link; used in the publish panel's "Blocked" list, the "Publish the
  website now?" dialog (now listing up to four problems, not just the
  first), and a refused scheduled publication. A refused publish's error
  message uses the one-line form.
- Tests: `apps/admin/scripts/test/publish-problems.test.mjs` (9), including
  that every link is a route the admin has.

Original note: messages such as `content.impact.sections: refers to story
"classroom-books"` name a data path, not an Admin page. Map each problem
path to a readable place and a link ("Impact page → Stories of change"),
in the publish panel and dialog.

## 5. Our Approach block — implemented, D11 decided, not yet tested

The Impact page record gains an `approach` block (M-B in
`docs/CONTENT_MIGRATION_PLAN.md`) holding the words of
/impact/our-approach. It is not a chapter of /impact.

- Contract: `packages/content-schema/src/impact/impact.ts` `ApproachData`
  (`intro?`, `principles[]` ≤ 12); `impact/registry.ts` — a `page` field
  marks blocks that feed a sub-page; `IMPACT_CHAPTER_TYPES` lists the ones
  drawn on /impact.
- Website: `scripts/snapshot-adapter.mjs` `impactPagesFrom` →
  `IMPACT.approach` (nested target); `impactFrom` leaves the block out of
  /impact.
  `pages/Approach/Approach.jsx` quotes the mission from the published
  About page's Mission & Vision block (the source mission otherwise).
- Admin: `impact/BlockEditor.tsx` form ("How we work", principles); the
  Impact page preview lists sub-page blocks apart (`blocks/Preview.tsx`
  `elsewhere`).
- Published empty, it approves nothing (status stays "placeholder").
- Migration: the source's intro and principles are marked approved in
  `apps/web/src/content/impact.js`, so the source Impact record
  (`src/contract/importers.js` `impactRecord`, used by the build's
  conformance check and the migration rehearsal) now carries them as its
  `approach` block, and the rehearsal no longer lists /impact/our-approach
  as unmapped. Nothing is written to any database: the production Impact
  page is reconciled by hand in the admin, as before.
- **D11 decided (2026-10-13):** Our Approach reuses the existing approved
  content — the mission, and `IMPACT.approach`'s intro and six principles
  as they stand. Nothing new was written. The **Listen → Partner → Act →
  Sustain** framework is **rejected** and must not be introduced: its
  hidden copy (`IMPACT.approach.proposedFramework`) and the homepage helper
  that would have shown it once approved (`approachSteps`) were removed;
  the homepage's approach section passes no steps (`content/homepage.js`,
  `pages/Home/CmsHome.jsx`, `components/ApproachFlow`).

## 6. Where We Work block — implemented with the D14 country selector, not yet tested

A `geography` block on the Impact page record (M-C) → /impact/where-we-work.

- Contract: `GeographyData` — `summary?`, `regions[]` (id, name, 1–60
  countries; ≤ 20), ungrouped `countries[]` (≤ 100). D14: each country
  must be a name from the shared list
  (`packages/content-schema/src/common/countries.ts`: ISO 3166-1, 249
  entries, also exported as `@rbb/content-schema/countries`), and appears
  once in the block (one region, or ungrouped).
- Website: → `IMPACT.geography`; "verified" only when a list is non-empty.
  `content/seo.js` indexes the page once regions OR countries exist (was
  countries only). The release approval `geography` stays RBB's.
- Admin: summary; regions (free-text name, id follows it) each with a
  country selector; a selector for countries not in a region.
  `impact/CountryPicker.tsx` — the full list, searchable (case and accents
  ignored), several at once, selection kept in alphabetical order, a
  country already placed elsewhere shown but not selectable, unknown
  stored names shown with Remove. Helpers in `impact/geography.ts`.
- **D14 decided (2026-10-13):** all countries are OPTIONS; the selection
  starts empty (a new block is `{ regions: [], countries: [] }`, and the
  website's own `IMPACT.geography` stays empty). Only selected countries,
  approved and published, are shown; while none is, the page shows no
  list, the adapter marks it "placeholder" and `content/seo.js` keeps it
  `noindex`. **No map.** Nothing assumes the unverified "25 countries"
  (D2, still pending review).
- Remaining: RBB selects its verified countries in the admin.

## 7. How We Work page editor — implemented (structure), not yet tested

A new single typed page (M-A), as Careers.

- Contract: `packages/content-schema/src/howWeWork/howWeWork.ts` —
  header, "In practice" cards (1–8: title, line, site glyph), passages
  (1–8: id, heading, passage, optional list); snapshot key `howWeWork`
  (published only, this organization's, no release marker).
- API: `modules/how-we-work/service.ts` (`how_we_work_pages`,
  `orgId_unique`), `/api/v1/how-we-work` block-page routes, publish
  service carries it and lists it for scheduling.
- Admin: `/how-we-work` editor (`pages/howWeWork/HowWeWorkPage.tsx`,
  `howWeWork/client.ts`), sidebar entry, publish-problem links (naming
  the card, passage or page header: `settings/publishProblems.ts`), publish
  panel label; glyph options shared with Programs (`content/glyphs.ts`).
- Website: `howWeWorkFrom` → `HOW_WE_WORK` and `HOW_WE_WORK.practices`;
  the posters, closing ask and SEO stay the site's.
- Blocker: the approved How We Work wording is RBB's (D11 — still open
  for this page; Our Approach's decision does not supply it). Until then
  no How We Work record is published, and the website keeps its own
  placeholder page.

Tests written for 5–7, **not yet run**: content-schema `impact.test.ts`
and `howWeWork/howWeWork.test.ts`; API `test/how-we-work.test.ts`; admin
`scripts/test/impact-subpages.test.mjs`; web
`scripts/test/published-snapshot.test.mjs` (updated and extended);
admin `scripts/test/publish-problems.test.mjs` (How We Work cases).
D11/D14/D35 (2026-10-13), also not run: content-schema `impact.test.ts`
(country list, countries from the list, one place per country, no map
fields); admin `impact-subpages.test.mjs` (search, ordering, places taken
elsewhere, the form uses the selector and starts empty); web
`scripts/test/legacy-giving-retired.test.mjs` (redirects, removed files,
Donate/Givebutter untouched, framework gone) and the updated
`published-snapshot.test.mjs`.
Docs: `docs/PUBLISHING.md`, `apps/web/CLAUDE.md` (snapshot mappings),
`apps/web/docs/FINAL_CONTENT_REPLACEMENT_CHECKLIST.md` (Admin locations).

Migration for 6 and 7 (`apps/web/scripts/migration/source.mjs`): not done,
and recorded as `excluded-by-policy` rather than a schema gap. Where We
Work has no verified source list (D14; the importer adds a `geography`
block automatically once a verified one exists in the source). How We
Work's source text is working placeholder prose awaiting RBB's wording
(D11). No importer test was added for `impactRecord` (it loads the content
modules through Vite); the build's conformance check validates it.

## 8. Giving methods / legacy giving pages — D35 decided, not yet tested

D35 (2026-10-13): delete the giving pages no longer in use. Repository
evidence, per route (`apps/web`):

| Route | Inbound links | Other dependencies | Outcome |
|---|---|---|---|
| `/giving` | none in `content/nav.js` (menu, footer, breadcrumbs) or any rendered page; one card in `content/pages.js`, a sample module nothing imports | `noindex` (`content/seo.js`), not in the sitemap; pending line only, pointed to Donate | **Removed**; forwards to `/appeals` |
| `/giving/zakat` | only from `/giving` itself | `noindex`; placeholder only | **Removed**; not forwarded — Donate would imply Zakat-specific giving — so it gets the not-found page, as the Zakat sub-pages retired before it |
| `/gifts` | none | `noindex`; pointed to Donate | **Removed**; forwards to `/appeals` |
| `/giving/major-giving` | none | `noindex`; same page as `/gifts` | **Removed**; forwards to `/appeals` |

Removed: the routes (`config/routes.js` LEGACY_PATHS, `App.jsx`,
`entry-server.jsx` pre-render list), the pages (`pages/Giving`, `Gifts`,
`Zakat`), their content (`content/giving.js`, `gifts.js`, `zakat.js`;
`DONATION.legacy`, `legacyGivingBlock` and its pending line in
`donation.js`), the components only they used (`components/DonationAction`,
`components/BannerHero`), their titles (`content/site.js`) and SEO entries.
Added: three REDIRECTS to `/appeals`, as `/donate` already does. Kept: the
image files (only unused sample modules import them; `scripts/responsive-
images.mjs` still lists two), `DONATION.givingMethods` (the Appeals page
reads it), Donate, appeals, appeal management and the Givebutter checkout
— unchanged. No giving-methods model (M-D) is needed. Docs: decision
register, content checklist, image inventory, content readiness,
`docs/PUBLISHING.md`.

## 9, 10, 13 — removed, not required; 11 — deferred

Scope decisions (2026-10-13). Not to be reintroduced unless RBB asks.

- **9 Branding management — removed.** The website keeps its built-in
  logo, favicon and static branding assets.
- **10 Analytics / Features — removed.** No measurement, no analytics
  provider, no consent banner; the theme switcher stays a deployment
  switch (`VITE_THEME_SWITCHER`), off.
- **13 General Pages editor — removed.** The "Pages" sidebar entry (a
  "Soon" placeholder with nothing behind it) is gone. The fixed pages and
  their dedicated editors, and the shared block-page service
  (`apps/api/src/modules/pages`), stay: every page editor uses them.
- **11 Donation settings — deferred: Givebutter integration to be handled
  later.** Settings → Donations (site-wide form defaults the website never
  read) is removed. Nothing is built for payments, credentials, webhooks
  or appeal designation / form overrides / run dates. The existing
  Givebutter checkout on the donation page and appeals, the Donate pages
  and appeal management are unchanged.

What was removed for 9, 10 and 11: the Branding, Analytics and Donations
sections of Admin → Settings (`pages/settings/sections.tsx`,
`SettingsPage.tsx`, `settings/client.ts`, publish panel labels); the API's
settings sections for them and the branding media check
(`modules/settings/service.ts`: a change to `branding`, `analytics`,
`donations` or `features` is now refused); the website's settings export
of them (`src/contract/importers.js`). Features never had an editor.

Kept on purpose: the contract (`SiteSettings`) still lists the four keys,
OPTIONAL and unchanged in shape, because the settings record already
stored in production and every published snapshot carry them — removing
them would make those invalid and the live website reject new snapshots
until it is redeployed. Nothing writes or reads them. Dropping the keys
needs a later, deliberate migration of the stored settings and a website
deploy first; it is not done here.

Tests and smoke scripts updated (not run): API settings, publishing,
media-usage and integration tests use the share image (`seo.ogImageId`)
where they used the logo; a test for stored records that still carry the
retired keys; content-schema fixture and a retired-sections test; admin
`smoke-settings.mjs` (four tabs) and `smoke-ui.mjs` (no "Soon" items).

## 15. Settings → General: country selection — implemented, not yet tested

An owner can select countries in Admin → Settings → General from the full
list (all 249, ISO 3166-1, `packages/content-schema/src/common/countries.ts`).

- Admin: `pages/settings/sections.tsx` `CountriesField` reuses the Where
  We Work selector (`impact/CountryPicker.tsx`), a dropdown: "Select
  countries" opens a searchable list (case and accents ignored), several
  at once, closed by Done, Escape or a click outside; selected countries
  stay listed above it, each with Remove. `SettingsPage.tsx` saves it as the settings' `countries`, shown
  on the General tab (no new tab or sidebar entry); `settings/client.ts`.
- Contract: `SiteSettings.countries` — optional, names from the list, each
  once (`common/countryField.ts`, shared with the Where We Work block).
- API: `countries` is a settings section (`modules/settings/service.ts`),
  saved with the revision check, validated and audited by field name like
  the others; owners only (`settings:write`).
- **Never published.** It is INTERNAL (`INTERNAL_SECTIONS`): the publish
  leaves it out of every snapshot (`publicSettings` in
  `modules/publishing/service.ts`, in the candidate and the content hash),
  so the website never receives it, selecting countries is not a change to
  publish, and `PublishedSnapshot` refuses it if it ever appeared. Settings
  that have none (all existing records) hash and publish exactly as before.
- Empty until someone selects. Selecting a country here does not make it a
  place RBB works: the public list stays the Impact page's Where We Work
  block (#6), published through review. No map; no "25 countries".
- Tests written, **not yet run**: API `test/settings/countries.test.ts`;
  admin `scripts/test/settings-countries.test.mjs`.

## 16. Website forms stored, and Admin → Form submissions — implemented

Owner decisions (2026-10-13): the website's **Contact Us**, **Volunteer**
and **Partner With Us** forms go live; what visitors send is **stored**
and readable by **owners only**, kept **until an owner deletes it**, and
**also emailed** once email is configured.

- One form system, as before: one component (`FormShell`), one field
  schema (`@rbb/forms`), one endpoint `POST /api/v1/forms/:formId` — the
  form id is the identifier stored with each submission.
- API: `modules/submissions/` — `MongoSubmissionStore` (`form_submissions`;
  four indexes, created by `api:db:indexes`), `SubmissionService` and
  routes (`GET /api/v1/submissions` with form, status, date and text
  filters, cursor pages and counts; `GET …/:id`; `POST …/:id/status`;
  `DELETE …/:id`), permissions `submissions:read` / `submissions:write`
  (owners). `modules/forms/service.ts` stores the validated fields only
  (no IP, user agent, honeypot or timing) for those three forms, emails
  when configured, and still answers the visitor if the email fails;
  bots and invalid input are never stored. Audit: by id and form only.
- Admin: Engagement → **Form submissions** (`/submissions`, owners only):
  totals per form, filters, table, a dialog with every field that marks
  it read, Mark as new, Delete (confirmed), and **Reply from the admin**
  (`POST /api/v1/submissions/:id/replies`): sent through the forms' email
  (same sender and mode), signed with the owner's name, Reply-To the
  form's RBB inbox, never quoting the visitor's message, recorded on the
  submission ("Replies sent", a Replied badge) and audited by id and form
  only; unavailable (503, and a note in the dialog) while email is off.
  "Open in mail app" stays as a fallback.
- Website: shown when the production deploy sets
  `VITE_FORM_ENDPOINT_CONTACT/_VOLUNTEER/_PARTNER` (exact production
  endpoints, enforced by `scripts/deploy-pages.mjs`).
- Not done here: the production `form_submissions` indexes
  (`api:db:indexes` against production — a separate, authorized step);
  email (API `EMAIL_*` settings and RBB's inbox, D21); the Privacy Policy
  wording about stored submissions (RBB's text).
- Tests: API `test/submissions.test.ts`; admin
  `scripts/test/submissions.test.mjs`; web `deploy-pages.test.mjs`.

## 17. Form builder and career application forms — implemented

Owner decisions (2026-10-13): a **full form builder** for the website's
forms; **one application form per open role** on the Careers page, with
file uploads; files in the **existing media bucket**, submission details in
the database; **owners only**; a saved form is **live at once** (no review).

- Contract (`packages/content-schema/src/forms/`): `FormDefinition` — id
  (`contact`, `volunteer`, `partner`, `career-<role id>`), kind, role,
  name, heading, intro, button, messages, and 2–25 fields (text, email,
  phone, long text, dropdown, checkbox, file). Every form keeps a required
  `name` and `email` (replies). Files: career forms only, at most 3, PDF /
  DOC / DOCX up to 4 MB. `DEFAULT_FORMS` (the built-in forms' words,
  `@rbb/content-schema/form-defaults`), `newCareerForm`. Snapshot
  `content.forms`. Career roles gain an optional `id`.
- API: `modules/form-definitions/` (store `form_definitions`; service and
  routes `GET/PUT/DELETE /api/v1/forms-admin[/:id]`, permission
  `forms:write`). Saving calls `PublishService.publishForms`: a new
  version that is the live snapshot with only `content.forms` replaced,
  keeping the source hash (forms are left out of the content hash), so
  nothing else goes live and "unpublished changes" is unaffected; a normal
  publish carries the forms too. Submissions to a saved form are checked
  against it (`modules/forms/definition.ts`); a form never saved keeps the
  built-in schema. Uploads: `POST /api/v1/forms/:formId/files?field=` (the
  file's bytes, through the API — the one route allowed past the 256 KB
  body limit), type from the file's first bytes, rate limited, stored by
  the API (`R2Storage.putObject`) under `private/forms/<org>/<random id>`
  (`form_uploads`), claimed by one submission; owners open a file through a
  5-minute signed link (`GET /api/v1/submissions/:id/attachments/:aid`,
  `R2Storage.presignGet`); the storage key is never returned; deleting a
  submission deletes its files; unclaimed uploads older than a day are
  removed by `FormUploadService.cleanup` (not yet scheduled). Career
  applications are emailed to `EMAIL_TO_CAREERS` when set (stored only
  otherwise); the email names files, never attaches them.
- Admin: Engagement → **Forms** (`/forms`, `/forms/:id`): every form, the
  Careers roles without one ("Create application form"), and the builder
  (wording; fields with label, type, required, help, placeholder, options;
  reorder; Save and publish; reset a built-in form / delete a career
  form). The Careers editor gives each role an id when saved (kept when
  renamed). Form submissions shows career form names, saved labels, and
  each attached file with Download.
- Website: `PUBLISHED_FORMS` (snapshot target `content/forms.js`) and
  `formConfig(id)` — the saved form, else the built-in one; Contact and
  the Get Involved pages use it; the Careers page draws each role's saved
  application form beneath the roles; new field types phone and file
  (`components/FileField`, uploads as soon as a file is chosen).
- Bucket safety: the media bucket has a public address, so files under
  `private/` are reachable only by anyone who has the exact (random) key —
  which is never shown. For a hard guarantee, block `/private/*` on the
  bucket's public domain with a Cloudflare rule (one line; not done).
- Deploy order: deploy the WEBSITE before saving a first form — the live
  website's contract does not know `content.forms` and would ignore a
  newer snapshot until it is redeployed.
- Tests: API `test/form-builder.test.ts` (7); content-schema
  `forms/formDefinition.test.ts`; admin `scripts/test/form-builder.test.mjs`;
  web `published-snapshot.test.mjs` (forms mapping). A scratch build from
  a fixture snapshot draws the saved Contact form and the Careers role's
  application form with its file field.

## 14. Audit Log screen — removed, not required

Scope decision (2026-10-13): RBB does not want an Audit Log in the admin.
It is out of scope and must not be reintroduced by a later task. The
implementation begun for it was removed from every layer (API route and
read service, the store's query methods, the admin page, route and the
"Soon" sidebar entry, and the `audit:read` permission, which existed only
for it). The API's audit TRAIL — the entries every service writes to
`audit_logs` — is unrelated shared infrastructure and stays as it was.
