/* Phase 0: browser smoke tests create, edit, archive and even publish
   records through whatever API the admin (or website) they are pointed at
   talks to — and a local dev server can be connected to the production
   database. So before signing in or writing anything, a smoke asks THAT
   API what it writes to: GET /api/v1/health/ready names the kind of
   database (production, test, unclassified, none — never its name;
   src/config/target.ts). Only "test" (a database ending in "_test") is
   allowed. Anything else — production, an unclassified database, an API
   that does not answer or does not say — is refused. There is no
   override.

   SMOKE_API_URL: ask the API there instead of through `base` (for a
   built site with no /api/v1 proxy). */

export async function smokeTargetProblem(base, { fetch: get = fetch, apiUrl = process.env.SMOKE_API_URL } = {}) {
  const url = `${(apiUrl || base).replace(/\/+$/, "")}/api/v1/health/ready`;
  let target;
  try {
    const response = await get(url, { signal: AbortSignal.timeout(10_000) });
    target = (await response.json())?.data?.target;
  } catch {
    return `could not ask the API at ${url} what it writes to — refusing rather than guessing`;
  }
  if (target === "test") return null;
  if (target === "production") return "the API is connected to the PRODUCTION database — smoke tests never run there";
  return `the API's database is "${target ?? "not stated"}", not a test database (a name ending in "_test") — refusing rather than guessing`;
}

/* For the smoke scripts: return when the target is a test database,
   otherwise say why and stop the process before anything is written. */
export async function requireTestTarget(base, options) {
  const problem = await smokeTargetProblem(base, options);
  if (!problem) return;
  console.error(`Refusing to run this smoke test: ${problem}. Nothing was changed.`);
  process.exit(1);
}
