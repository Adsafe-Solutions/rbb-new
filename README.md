# RBB platform

A pnpm monorepo. The Rising Beyond Borders public website is the first app;
the admin and API are foundations only (M0).

```
apps/web/       the public website — Vite + React (JavaScript), pre-rendered.
                Its own guide: apps/web/README.md, apps/web/CLAUDE.md, apps/web/docs/
apps/admin/     the admin — Vite + React + TypeScript; sign-in and a signed-in shell (see apps/admin/README.md)
apps/api/       the API — Node + TypeScript + MongoDB (see apps/api/README.md)
packages/       content-schema — the content contract (Zod); forms — the form
                domain; money — boundary, empty until needed
docs/           platform docs — start with docs/MONOREPO.md
```

## Commands

Run from the repository root (pnpm 9.15.2, Node ≥ 22.18):

```sh
pnpm install

pnpm web:dev              # http://localhost:5173
pnpm build                # = pnpm web:build — client + SSR builds, then prerender
pnpm web:validate         # content validation
pnpm web:test             # server tests + release tests
pnpm web:release:status   # release state
pnpm web:release          # full production release check (release:check)
pnpm web:serve            # built site + form endpoint locally, http://localhost:5190
pnpm web:smoke -- --url=http://localhost:5190

pnpm admin:dev            # http://localhost:5174
pnpm admin:build
pnpm api:dev              # http://localhost:4000/api/v1/health
pnpm api:build            # typecheck + bundle into apps/api/dist
pnpm api:test             # unit tests
MONGODB_TEST_URI=… pnpm api:test:integration   # disposable MongoDB only
pnpm api:db:indexes       # create missing indexes (non-destructive)
pnpm api:auth:bootstrap -- --confirm   # create the FIRST owner (see apps/api/README.md)
pnpm admin:smoke          # browser sign-in test against a running admin + API
pnpm schema:test          # content contract tests
pnpm typecheck            # content-schema + admin + api
```

Every web script also still runs inside `apps/web` (`pnpm run <script>`), as
before. Install with pnpm only — never `npm install` inside an app.
