# RBB platform

A pnpm monorepo. The Rising Beyond Borders public website is the first app;
the admin and API are foundations only (M0).

```
apps/web/       the public website — Vite + React (JavaScript), pre-rendered.
                Its own guide: apps/web/README.md, apps/web/CLAUDE.md, apps/web/docs/
apps/admin/     admin foundation — Vite + React + TypeScript (boots only)
apps/api/       API foundation — Node + TypeScript (GET /health only)
packages/       content-schema — the content contract (Zod); forms, money —
                boundaries, empty until a milestone needs them
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
pnpm api:dev              # http://localhost:4000/health
pnpm api:build
pnpm api:test
pnpm schema:test          # content contract tests
pnpm typecheck            # content-schema + admin + api
```

Every web script also still runs inside `apps/web` (`pnpm run <script>`), as
before. Install with pnpm only — never `npm install` inside an app.
