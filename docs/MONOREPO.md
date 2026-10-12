# Monorepo layout (M0)

The RBB website moved, unchanged, from the repository root into `apps/web`.
Everything it owns moved with it, so every path its scripts use — all of them
resolve from their own location (`scripts/*.mjs`, `server/dev-server.mjs`,
`vite.config.js`) — still points at the same files.

| Path | What | Notes |
| --- | --- | --- |
| `apps/web/` | Public website | `src/`, `public/`, `index.html`, `vite.config.js`, `scripts/`, `server/` (the form endpoint, until M2), `release/`, `docs/` (RBB specifications and runbooks), `.prettierrc.json` |
| `apps/admin/` | The admin (M3, design system) | Vite + React + TypeScript; its own design system (`src/design-system/`), sign-in and the signed-in shell |
| `apps/api/` | The API (M2–M18) | Node + TypeScript + MongoDB, for Vercel. Health, readiness, authentication, RBAC, audit, the CMS content and publishing, media (R2), users and roles, and the website's forms (`POST /api/v1/forms/:formId`, M18). See its README |
| `packages/content-schema` | The content contract (M1) | Zod schemas for every content record; see its README |
| `packages/forms` | The form domain (M2) | Form schema and `validateSubmission`, shared by the web's forms and the API's form endpoint (M18; the old `apps/web/server` endpoint until it is retired) |
| `packages/money` | Shared-code boundary | Empty until server-side donation code needs it |
| `docs/` | Platform docs | This file |
| root | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore` | |

## Environment files

Nothing changed except the directory they sit in.

| File | Read by | Contains |
| --- | --- | --- |
| `apps/web/.env.example` | people (template) | `VITE_*` names, no values |
| `apps/web/.env.development`, `apps/web/.env.production` | Vite (`loadEnv` from the app's own directory) | public `VITE_*` values only |
| `apps/web/.env.local` (git-ignored, optional) | Vite, every mode | local overrides |
| `apps/web/server/local.env` | `pnpm web:serve` | reserved demo values, no secrets |
| `apps/web/server/.env.local` (git-ignored) | `pnpm web:serve`, loaded after `local.env` | local server secrets |
| `apps/web/server/env.example` | people (template) | server variable names for the host's secret store |

Publishing: `docs/PUBLISHING.md`. The web build reads an optional
`RBB_SNAPSHOT_URL` (and `RBB_SNAPSHOT_REQUIRED` / `RBB_SNAPSHOT_VERSION`,
and for the runtime snapshot `RBB_SNAPSHOT_RUNTIME`,
`RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS`, `RBB_MEDIA_ORIGINS`). These are build
environment variables, not `VITE_` ones; the build compiles the public
part of the runtime configuration in itself.

`apps/admin` reads only optional `VITE_API_BASE` / `VITE_ADMIN_DESIGN_SYSTEM` (and `ADMIN_API_PROXY` for its dev proxy); its branding is code, in `apps/admin/src/theme/`. `apps/api` has its own: `apps/api/.env.example`
(placeholders) → `apps/api/.env.local` (git-ignored) locally, Vercel's
Environment Variables in deployment — see `apps/api/README.md`.

## Dependencies

- `pnpm-lock.yaml` was generated with `pnpm import` from the web's npm
  `package-lock.json`. All 157 packages kept the exact versions npm had
  resolved. The npm lockfile is gone; `pnpm install` from the root is the
  only install.
- pnpm uses one `vite@7.3.6` for the whole workspace, so the lockfile records
  the optional type-only `@types/node` peer (which admin and API declare)
  against the web's Vite too. It is the same Vite, and nothing changes at
  runtime.
- `apps/web/scripts/release-check.mjs` still runs the web's scripts through
  `npm run`. That works inside the pnpm workspace, because npm only reads the
  scripts in `apps/web/package.json` and the binaries pnpm links into
  `apps/web/node_modules/.bin`.
- `apps/api` dev runs `.ts` directly with Node's built-in type stripping,
  which needs Node 22.18 or later. `pnpm api:build` compiles to `dist/` with
  TypeScript 7.
