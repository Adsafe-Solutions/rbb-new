# @rbb/admin

The CMS admin, product name **RBB Studio**: Vite, React and TypeScript,
with its own design system. That design system is not shared with the
public site. It holds the sign-in screen, the signed-in shell (sidebar, topbar and
dashboard), the design system, the content modules, the **Media Library**
(`/media`; see `docs/MEDIA_LIBRARY.md`), and **Users & Roles** with account
security (M17.3, below).

```sh
pnpm admin:dev        # http://localhost:5174, with the API at http://localhost:4000
pnpm admin:build
ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke      # browser sign-in flow test
ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke:ui   # shell, design system, keyboard, axe (dev server)
ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke:media # media library: upload, edit, delete, responsive, axe
ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke:users # users & roles, setup links, account, setup page, axe
```

## Posts and Events

- **Screens:** `/posts` and `/events` are lists with search, status and type
  filters, sorting and pages, plus the publish panel. `/posts/:id` and
  `/events/:id` are focused editors (`new` creates one).
- **Shared logic:** `src/content/editor.tsx` handles saving, unsaved state,
  conflicts with "Reload latest", confirming a published-address change,
  and archiving with "Reopen as draft".
- **Rich text:** `src/content/RichTextEditor.tsx` is an in-house block editor
  with no dependency. Each block is a text area, with **bold**, *italic* and
  [link](https://…) typed or inserted from the toolbar.
  `src/content/richtext.ts` turns this into the content contract's RichText
  JSON, which is never HTML. Its round trip is unit-tested:
  `pnpm admin:test`.
- **Browser test:** `pnpm admin:smoke:content`, against a LOCAL database.
  Everything it creates is archived at the end.

## Settings and publishing

`/settings` edits the organization's site settings: General, Contact,
Social and SEO. General also holds a country selection (all countries,
searchable, several at once), saved with the settings but never published. Branding, analytics, donation defaults and features are
not managed in the admin (retired, 2026-10-13); the general Pages editor
and the Audit Log are not part of the admin either.
- **Fields are typed,** with the contract's limits. The API validates every
  save, and its field errors are shown inline.
- **Unsaved edits** are marked per section. A conflict offers "Reload latest
  version".
- **Owners publish** from the panel at the top, which shows the live version
  and unpublished changes. Editors can view only.
- **Logo, favicon and share image** use `src/media/MediaPicker.tsx`, which
  picks ready images from the Media Library by ID.

There is no Footer or Navigation section, because the content contract
doesn't hold either yet. See `docs/PUBLISHING.md`. Browser test:
`pnpm admin:smoke:settings`, against a LOCAL database; it restores and
republishes what it changes.

## Media Library

- **Uploads go straight from the browser to R2.** The API issues a
  short-lived presigned URL, and `src/media/client.ts` PUTs the file to it
  with an XMLHttpRequest, so progress can be shown. File bytes never go to
  the API, and the admin holds no storage credential.
- **The upload queue** (`src/media/uploads.ts`) checks files against the
  API's policy first, for instant feedback. It then runs request → PUT →
  complete, at most three at a time, with cancel and retry. Retry always asks
  for a new upload URL.
- **Showing and hiding controls** goes through `useCan()` (`src/auth.tsx`).
  That's a courtesy only: the API enforces the permissions.
- **Locally,** the bucket's CORS must allow `http://localhost:5174`. Without
  it, run the API with the fake R2 instead
  (`apps/api/test/support/dev-server-fake-storage.ts`).

## Design system

Everything lives in `src/design-system/`, and the rest of the admin
imports only from its `index.ts`. The design language is Geist-inspired
(Geist Sans and Geist Mono, OFL-1.1, self-hosted through
`@fontsource-variable`). It is coloured by the organization's brand.

**Tokens come in three layers. Components read only the semantic one.**

| Layer | Where | What |
|---|---|---|
| Primitive | `tokens/primitives.css`, `tokens/typography.css` | Neutral ramp, status hues, type roles, spacing (4–64px, 8px rhythm), radius (4/6/8/10), motion, z-index, shell sizes |
| Semantic | `tokens/semantic.css` | What a colour is *for*: `--color-text-muted`, `--color-primary-hover`, `--color-success-fg`, `--shadow-dialog`… Hover, tint and focus colours are derived with `color-mix()` |
| Brand | `src/theme/rbb.ts`, applied by `applyTheme()` | Six colours, the organization and product names, and the logo |

**Rules the tokens encode:**
- Sky Blue (the accent) is never text on a light surface, because it is
  2.5:1 on white. Text and the focus ring use darkened mixes of it.
- A status is never colour alone. `StatusBadge` always pairs an icon with
  a word.
- Cards use 1px borders. Shadows are only for things that float: menus,
  popovers, dialogs, the command menu and toasts.

**Rebranding (a fork):** copy `src/theme/rbb.ts`, change the values and
the logo, then point `src/theme/index.ts` at the copy. No component
changes.

**Themes:** `<html data-theme="light">` is the designed default.
`[data-theme="dark"]` has a value for every semantic token. It exists to
prove the architecture and has not been designed.

**Icons:** Lucide (ISC) is the only icon set. Import icons from
`src/design-system/icons.ts`, never from `lucide-react` directly.

**Preview:** `/design-system` renders every token and component live,
including measured contrast. It exists in `vite dev` only. A build
includes it only with `VITE_ADMIN_DESIGN_SYSTEM=true`, and without that
flag the code is not in the bundle.

**Shell responsiveness:**
- **1024px and wider:** the sidebar is expanded (248px) and can collapse
  to a rail.
- **768–1023px:** the sidebar is a 60px icon rail with tooltips.
- **Below 768px:** the sidebar becomes a modal drawer (a native
  `<dialog>`).

Modules that aren't built yet appear in the sidebar marked "Soon". They
aren't links. Search, help and notifications in the topbar are marked as
unavailable.

## Form submissions (owners only)

`/submissions` (Engagement → Form submissions) lists what visitors sent
through the website's Contact Us, Volunteer and Partner With Us forms,
newest first, with totals per form and filters (form, new/read, dates,
text). Opening one shows every field and marks it read; it can be marked
new again, answered, or deleted for good. **Replies are written and sent
from the admin** while email is set up: emailed to the visitor from RBB's
sender, signed with the member's name, Reply-To the form's RBB inbox,
without quoting the visitor's message, and listed under "Replies sent".
"Open in mail app" is always there too.
The route and the API need `submissions:read` / `submissions:write`.

## Users & Roles, your account, setup links (M17.3)

- **`/users` (owners only).** The route needs `users:read`; anyone else gets
  "No access" and no member data is requested. Navigation items can name a
  permission too (`shell/navigation.ts`), so editors don't see the entry.
  The API authorizes every change again.
  - The table: role, effective status, password set or awaiting setup,
    active sessions, last change and revision. No internal field is shown.
  - Add member, change role, sign out everywhere, deactivate and reactivate,
    each behind a confirmation dialog. Your own row has no actions (the API
    refuses changes to yourself too); it links to Your account.
  - A stale change (409: changed elsewhere, last active owner, busy) is
    explained, and the list reloads. Only the newest list request may fill
    the table, so a slow load never replaces a fresh change.
  - Rules the page applies (which actions a member gets, the password
    rule, token parsing, error wording) are in `src/users/rules.ts`, with
    unit tests.
- **Setup links.** "Issue setup link" (members without a password) shows
  the link **once**, with a copy button and a warning that anyone holding it
  can set the password. Its token lives in that dialog's state only — never
  storage, the URL, a toast or the log — and is dropped when it closes.
  Nothing re-shows it: a new link must be issued, which revokes the old one.
  The link is `<admin origin>/setup-password#token=…`; the token is in the
  fragment, which browsers never send to a server.
- **`/setup-password` (public).** It reads the token from the fragment once
  (also for a link opened in the same tab), clears it from the address bar
  at once, and keeps it in memory until the submission ends. It asks for
  the password twice. An unusable link (used, expired, revoked or unknown)
  gets one message, after submitting, because the API has no "check link"
  endpoint.
- **`/account` (everyone).** Shows who you are and changes your password:
  current password, then the new one twice. The API signs the account out
  everywhere else and gives this browser a fresh session cookie, so the
  admin only re-reads `/auth/me`. Wrong current password, throttling (429)
  and policy errors are shown on the form.

## How it authenticates

The API decides everything. The admin holds no token.

- **Signing in:** `POST /api/v1/auth/login` makes the API set an **HttpOnly**
  session cookie. Scripts can't read it, and nothing is put in
  `localStorage` or `sessionStorage`.
- **Who's signed in:** comes from `GET /api/v1/auth/me` on load, and again
  whenever the tab becomes visible. It is held in React memory only. A 401
  means signed out, which sends you to `/login`.
- **Guards:** the client-side route guard is for navigation only. The API
  authorizes every request itself.

## Talking to the API

The admin calls the API on **its own origin** (`/api/*`), which keeps the
session cookie first-party.

| Where | How `/api/*` reaches the API |
|---|---|
| Local | Vite's proxy, to `ADMIN_API_PROXY` (default `http://localhost:4000`). The API needs `ADMIN_ORIGIN=http://localhost:5174` |
| Vercel (later) | A rewrite of `/api/(.*)` to the API deployment, plus a fallback of every other path to `/index.html` |

`VITE_API_BASE` can point at another origin instead. In that case the API
must list this origin, and the cookie becomes third-party, which browsers
increasingly block.

Branding — names, colours and logo — is code, in `src/theme/`, not
environment configuration.

There is no registration and no password reset. The first owner is created
with the API's bootstrap command.
