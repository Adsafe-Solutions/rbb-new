# Working in this monorepo

pnpm workspace: `apps/web` (public site), `apps/admin`, `apps/api`, and
`packages/*`. Layout, commands and where env files live: `docs/MONOREPO.md`.
The public site's own rules are in `apps/web/CLAUDE.md` — read them before
touching anything under `apps/web`.

- Install with pnpm from the root. Never `npm install` inside an app; the one
  lockfile is `pnpm-lock.yaml`.
- `apps/web` stays JavaScript on Vite with its own pre-render. Do not move it
  to Next.js or TypeScript.
- The web and the admin have separate design systems. There is no shared UI
  package; `packages/` holds only shared non-UI code (schemas, form rules,
  money).
- After changing anything the web build depends on, `pnpm build` must still
  pre-render the same routes, and `pnpm web:validate`, `pnpm web:test` and
  `pnpm web:release:status` must still pass.
