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
| 3 | Refuse `[RBB to confirm: …]` placeholders in published text | S | Done — committed and pushed (`bb58fad`); API deployment not independently verified; website not deployed |
| 4 | Publish errors that say where to fix them | M | Done — committed and pushed (`9e3d230`); live in the Admin (verified 2026-10-13) |
| 5 | Our Approach block on the Impact page | M | Needs content decision — next buildable |
| 6 | Where We Work (geography) block on the Impact page | M | Needs RBB's list (D14) |
| 7 | How We Work page editor | M | Needs wording (D11) |
| 8 | Giving methods / legacy giving pages | M | Needs decision (D35) |
| 9 | Settings → Branding applied on the website | L | Needs CSP + image pipeline |
| 10 | Settings → Analytics / Features editors | S–M | Needs approval of measurement |
| 11 | Donation settings, appeal designation / form overrides / run dates applied | M | Payment-adjacent: needs approval |
| 12 | Contact method description editable | S | Done — committed and pushed (`13d0749`), tests verified; live in the Admin (verified 2026-10-13) |
| 13 | Pages (general page editor) | L | Scope to be agreed |
| 14 | Audit Log screen | M | Planned |

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

## 3. Placeholders in published text — done

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

## 5–14

Each needs a decision or approval first; it is planned in detail when that
arrives. See `docs/CONTENT_MIGRATION_PLAN.md` ("Proposed models") for 5–8.
