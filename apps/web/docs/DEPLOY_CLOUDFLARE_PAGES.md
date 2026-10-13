# Deploying the website to Cloudflare Pages from the terminal

`pnpm deploy:web`, at the repository root, builds the website exactly as
the Cloudflare Pages project does and uploads the result to that project
with Wrangler. It is a **production deployment**: what it uploads becomes
`https://prod.risingbeyondborders.org`.

It exists as a **fallback**. The Pages project `rbb-web` is connected to
this repository and set to deploy `main` automatically, but the
dashboard currently reports the project as disconnected from its Git
account, and no deployment appeared for the latest commit. Until that
integration is repaired and seen to deploy a commit on its own, the
terminal command is how a commit reaches production. The integration
still needs repairing, and automatic deployment remains unverified —
nothing in this repository changes or claims to fix it.

## The one source of truth for build settings

The Pages project's settings (production branch `main`, root
`apps/web`, build command `cd ../.. && pnpm --filter @rbb/web run build`,
output `dist`) are the deployment's settings. `deploy:web` does not
duplicate them in a config file; it runs the same build command from the
repository root and uploads `apps/web/dist` to the same project and
branch, and it refuses to run with anything but the production
configuration below. If the project's settings change, change the
constants at the top of `apps/web/scripts/deploy-pages.mjs` with them.

## Authentication

Wrangler (`wrangler@4.149.0`, pinned in `apps/web/package.json`, installed
by `pnpm install` — never a global or a "latest" fetched at deployment
time) authenticates in one of two ways. The deployment never prints a
token, and no token belongs in Git.

1. **A browser login (interactive terminals):**
   `pnpm --filter @rbb/web exec wrangler login` — opens Cloudflare, stores
   a session in Wrangler's own config directory, outside the repository.
   `pnpm --filter @rbb/web exec wrangler whoami` shows who you are.
2. **An API token (non-interactive):** create a token in the Cloudflare
   dashboard (My Profile → API Tokens) with the **Cloudflare Pages: Edit**
   permission on the account, and note the account id (Workers & Pages →
   Overview). Put both in your shell, or in `apps/web/.env.deploy.local`
   (git-ignored; template: `apps/web/deploy.env.example`):
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Before deploying, the command runs `wrangler whoami` and stops if it
fails.

## Variables

| Variable | Required value | Why |
| --- | --- | --- |
| `RBB_SNAPSHOT_URL` | `https://api.risingbeyondborders.org/api/v1/public/snapshot` exactly | The build fetches the published CMS snapshot from the production API, and the browser asks the same endpoint for newer ones |
| `RBB_SNAPSHOT_REQUIRED` | `1` | The build must use the API's snapshot, never the saved copy (`fixtures/published-snapshot.json`) |
| `RBB_SNAPSHOT_RUNTIME` | `on` | The runtime snapshot (`docs/PUBLISHING.md` "Runtime snapshot"). The build treats unset as on and accepts only `on` or `off`; the deployment demands the explicit `on` |
| `VITE_SITE_URL` | unset, or `https://prod.risingbeyondborders.org` | Anything else is refused |
| `VITE_ENVIRONMENT` | unset, or `prod` | |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | both, or neither (then `wrangler login`) | |

Put them in `apps/web/.env.deploy.local` (read by the command only; Vite
never reads it) or export them in the shell. **A Vite env file
(`apps/web/.env`, `.env.local`, `.env.production`, `.env.production.local`)
may hold `VITE_` keys only.** The command refuses to build while one of
them holds anything else — a website env file is public configuration;
the API's secrets live in the API's own environment.

To check the configuration without deploying, run the command with
`--check` (below): it prints each variable as `set` / `unset` — never a
value — and stops after the build.

## Commands

```sh
# A production build, no deployment (what the Pages project runs):
RBB_SNAPSHOT_URL=https://api.risingbeyondborders.org/api/v1/public/snapshot \
RBB_SNAPSHOT_REQUIRED=1 RBB_SNAPSHOT_RUNTIME=on pnpm web:build

# The preflight and the build, stopping before the deployment:
pnpm deploy:web:check

# THE PRODUCTION DEPLOYMENT (asks you to type "deploy"; --yes skips the question):
pnpm deploy:web
```

What `pnpm deploy:web` does, in order — and it stops, with a non-zero
exit and nothing deployed, at the first failure:

1. Prints the configuration by name (set/unset) and the target: project
   `rbb-web`, branch `main`.
2. Checks the variables above; that the checkout is `main`, has no
   modified tracked files (untracked files are allowed), and that `HEAD`
   is `origin/main` (it fetches first) — production is a pushed commit,
   never a working copy; and that the Vite env files hold `VITE_` keys
   only.
3. `wrangler whoami`.
4. Runs `pnpm --filter @rbb/web run build` from the repository root.
5. Checks the build: `dist/` is complete; `build-meta/published-snapshot-status.json`
   says a snapshot from the production API was applied;
   `build-meta/runtime-snapshot.json` names the production endpoint; the
   page policy (`dist/_headers`, `dist/index.html`) allows `connect-src`
   to the API; nothing names a local host.
6. Shows the commit, file count and the exact Wrangler command, and
   waits for `deploy`.
7. `wrangler pages deploy dist --project-name rbb-web --branch main
   --commit-hash <HEAD> --commit-message <subject> --commit-dirty=false`.

It never pushes to Git, changes the Pages project's settings or its Git
integration, touches the API or the CMS, publishes content, runs the
content-import writer, or deploys `www.risingbeyondborders.org` (a
separate site). No ordinary command (`build`, `test`, `dev`) deploys.

## Verifying a deployment

- Wrangler prints the deployment URL. In the dashboard (Workers & Pages →
  rbb-web → Deployments) the new production deployment shows the commit
  hash the command passed; it should be the hash `git rev-parse HEAD`
  prints on `main`.
- `https://prod.risingbeyondborders.org/` serves the new build: view the
  source and compare the asset file names with `apps/web/dist/index.html`,
  or check a change you expect to see.
- `curl -sI https://prod.risingbeyondborders.org/ | grep -i content-security-policy`
  shows `connect-src 'self' https://api.risingbeyondborders.org`.
- `pnpm web:smoke -- --url=https://prod.risingbeyondborders.org` (docs/LAUNCH_RUNBOOK.md).
- The runtime snapshot works only once the API's `WEB_ORIGIN` names
  `https://prod.risingbeyondborders.org`; until then every visitor sees the
  snapshot the build baked in (docs/PUBLISHING.md).

## When a deployment is needed at all

Once a runtime-snapshot build is live, **publishing CMS content does not
need a frontend deployment** for pages the build already has: the next
page load fetches the newer snapshot. A deployment is still what makes

- a **new address** (a story, project, profile, appeal or post published
  since the build) a real pre-rendered page with HTTP 200 and a sitemap
  entry — until then it renders in the browser behind `404.html`;
- a **build-time page-policy change** take effect: a newly published
  Givebutter checkout or a homepage video, whose origins are allowed per
  page at build time;
- any **code or source-content change** live.

## Remaining dashboard work (not done by this repository)

- Reconnect the Pages project to the GitHub account and confirm that a
  push to `main` produces a deployment on its own.
- Confirm the project's production environment variables carry
  `RBB_SNAPSHOT_URL`, `RBB_SNAPSHOT_REQUIRED=1` and `RBB_SNAPSHOT_RUNTIME=on`
  (the same values the terminal command demands), so both paths build
  the same site.
- Set the API's `WEB_ORIGIN` (its own environment) to the site's origin.
