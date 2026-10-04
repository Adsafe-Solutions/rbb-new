# Content & editorial guide — Rising Beyond Borders website

Document 18. How RBB content is added, checked, approved and published.
The website's content lives in the repository, in `src/content/`, and is
published by building the site. **There is no CMS, admin area, editor
login, database or content API** — see *Future CMS* at the end.

## Where content lives

| File | Content |
| --- | --- |
| `homepage.js` | Homepage sections |
| `about.js` | About page |
| `work.js` | The four program areas; project records |
| `impact.js` | Impact figures, geography, approach, measurement |
| `getInvolved.js` | The ways to take part |
| `stories.js` | Story records and categories |
| `contact.js` | Contact methods, careers |
| `transparency.js` | Financial overview, reports, governance |
| `team.js` | Team records and groups |
| `donation.js` | Donation page, giving methods, donation FAQs |
| `policies.js` | Privacy, terms |
| `forms.js` | Form configurations (all disabled) |
| `seo.js` | Page metadata rules (derived from the files above) |

Components never hold content; they read these files. A figure or fact is
stated **once** and referenced from there — the impact figures, for
example, come only from `impact.js`, whichever page shows them.

## Status

Every record carries an internal status. It is a publishing control —
never shown to visitors.

| Status | Meaning | In production |
| --- | --- | --- |
| `approved` | RBB has approved it for publication | Published, if it passes validation |
| `pending-review` | Prepared, awaiting RBB review | **Removed at build time** |
| `draft` | Work in progress | **Removed at build time** |
| `archived` | Previously published, now retired | **Removed at build time** — add a redirect if it had a public URL |
| `placeholder` | Structural empty state | Shown only as a clearly pending state |

Some earlier modules (`contact.js`, `transparency.js`, `impact.js`) use
`verified` for the same meaning as `approved`.

Projects use **`editorialStatus`** for this, because a project's own
`status` field is its stage as RBB states it (shown on the page).

### How unapproved records are kept out

For stories, projects, team members, giving methods and donation FAQs,
`scripts/content-publishing.mjs` **removes every non-approved record at
build time**, before bundling. They are not hidden — they are absent from
the JavaScript, the pre-rendered HTML, the sitemap and structured data.
The dev server keeps them (so they can be reviewed), and the pages still
show only approved records there too.

Even so: **never put confidential material into a content file.** The
repository itself is shared with everyone who works on the site.

Impact and financial figures are not publishing records: they are shown
with their own verification note (e.g. "pending final verification") and
are not removed by the filter. Changing one affects Home, Impact and
Transparency together — treat it as a high-review change.

## Content models

Required fields for an **approved** record are marked ●. Everything else is
optional and simply not shown when absent — leave a field out rather than
guess it.

**Story** (`stories.js`, `STORIES`) — Document 07
● `id`, ● `slug`, ● `title`, ● `status`, ● `category` (`news`, `field`,
`impact`, `community`), `excerpt` (recommended: cards and the page
description use it), `date` (`YYYY-MM-DD`), `author`, `featured` (one
story at most), `image` `{ src, alt }`, `body` `[paragraph]`, `location`,
`programId` (a program slug), `projectId` (an approved project's slug),
`impact` `[string]`, `quotes` `[{ text, attribution }]`, `media`
`[{ src, alt }]`, `relatedStoryIds` `[approved story slug]`.

**Project** (`work.js`, `PROJECT_RECORDS`) — Document 04
● `id`, ● `slug`, ● `editorialStatus`, ● `title`, ● `program` (`education`,
`health-wellbeing`, `livelihoods`, `community-support`), ● `description`,
`location`, `status` (the project's stage), `image` `{ src, alt }`,
`context`, `activities` `[string]`, `impact` `[{ value, label }]`,
`partners` `[string]`, `story` `{ title, excerpt, to }`, `featured`.

**Team member** (`team.js`, `TEAM_MEMBERS`) — Document 10
● `id`, ● `slug`, ● `name`, ● `role`, ● `status`, ● `category` (a
`TEAM_GROUPS` id), `departmentOrArea`, `shortBio`, `biography`
`[paragraph]` (a profile page exists only with this), `image` + ●
`imageAlt` when there is an image, `location`, `socialLinks`
`[{ label, url }]` (https), `relatedLinks` `[{ label, to }]` (a real
page), `order`, `featured`, `approvedAt` (`YYYY-MM-DD`). Only what the
person and RBB approve for publication.

**Policy** (`policies.js`) — Document 13 · **Giving method / donation FAQ**
(`donation.js`) — Document 11 · **Contact method** (`contact.js`) —
Document 08: see the schema comment at the top of each file.

## Validation

`src/content/validate.js` runs on **every production build** and stops it
on any error:

- `id` and `slug` present and unique; slugs lowercase and hyphenated
  (`field-visit-2026`, not `Field_Visit`)
- statuses, story categories, program areas and team groups are known values
- required fields for approved records (above)
- references resolve: story → program / approved project / approved
  related stories; project → program; team links and project story
  links → real pages; policy → policy / contact method
- images: a local file (no external media without the Document 17
  review), alt text unless marked `decorative: true` (then `alt: ""`), and
  the file present in the build
- no two pages on one address; no page that is also a redirect; every
  redirect lands on a real page
- no form `recipient` in the content (a server setting)
- the excluded **120+** figure appears nowhere

Messages name the file, record and field — for example
`stories.js STORIES[field-visit]: \`date\` must be YYYY-MM-DD`.

To check records **while preparing them** (drafts and pending included,
held to the approved rules):

```sh
npm run validate:content
```

## Workflow

1. RBB supplies the source material.
2. It is mapped into the right content model, with status `pending-review`.
3. `npm run validate:content` passes.
4. RBB reviews it — on the dev server (`npm run dev`) or a preview build.
5. RBB approves; status becomes `approved`.
6. `npm run build` validates it again and pre-renders its page.
7. The build report shows it counted (see below); QA checks the page.
8. Deployment publishes it.

Content changes go live only with a new build and deployment.

**Change safety.** Numbers, names, roles, partner names, locations and
financial information are high-review fields. Keep text traceable to what
RBB supplied; do not strengthen claims or turn uncertainty into
certainty. When sources conflict, stop and ask RBB — do not pick a value.

## Slugs and URLs

Lowercase, stable, readable, unique, and never containing personal
information. **Do not change a published slug casually.** If one must
change, add a permanent redirect from the old address in `REDIRECTS`
(`src/config/routes.js`), pointing straight at the new one — the build
rejects redirect chains and redirects to pages that do not exist.

## Build report

Every `npm run build` prints, and writes to `build-meta/content-report.json`:

```
content: 0 stories, 0 projects, 0 team, 0 policies, … approved; 0 records held back by the publishing filter
```

`build-meta/content-excluded.json` breaks the held-back count down by
collection. Both contain counts and field locations only — never content.

## Images

Approved RBB imagery only. Every meaningful image needs alt text that
describes it; purely decorative images are marked `decorative: true` with
`alt: ""`. Photographs are optimised per Document 15
(`scripts/responsive-images.mjs`). No external embeds (video, maps,
social) without the Document 17 technology and privacy review.

## Future CMS

A CMS may be evaluated later if RBB needs non-developer publishing. It
would be a **separate architecture project**, needing authentication and
roles, an editorial workflow and permissions, a database or managed
content platform, media management, preview and publishing controls, a
migration from these files, and a new privacy and security assessment.
None of that is part of the current site.

## Decisions pending RBB

Editorial owner and approver · the final approval workflow · approved
content records · approved imagery · verified impact and financial
figures · team information · project information · contact information ·
any future decision to introduce a CMS.

## Working placeholder records (Document 27)

There is ONE content source. A record that is a working placeholder is an
ordinary `"approved"` record in its own content file — it is published,
and it says on its face that it is a placeholder (see
`docs/WORKING_CONTENT.md` for the wording rules). There is no `"demo"`
status and no `src/content/demo/`.

To replace one, edit the record in place: drop the self-labelling, put
RBB's approved words in, and re-run `npm run build && npm run
release:status` — the release state counts what is left.
