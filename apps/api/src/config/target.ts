/* Which real resources a configuration points at (Phase 0, production
   safety). NODE_ENV says how the process behaves — cookies, logging — not
   WHERE it writes: a development server can be connected to the
   production database, and was. So the target is read from the
   resources themselves:

     production    MONGODB_DB is the production database. The
                   configuration must also say so on purpose,
                   RBB_TARGET=production, and name its organization,
                   ORGANIZATION_ID=rbb — or it is refused (env.ts).
     test          MONGODB_DB ends in "_test" (the dedicated test
                   database, e.g. risingbeyondborders_test).
     unclassified  any other database (a local one, a scratch one). Not
                   production, but not proven to be a test database
                   either: test and smoke tooling refuses it.
     none          no database configured.

   The production bucket may only be used with the production database,
   and the production database only with the production bucket: test or
   development media never lands among the website's, and production
   records never point at another bucket's objects.

   Names only — never a connection string or a credential. */

/* The production database and the organization it serves. */
export const PRODUCTION_DATABASES: Readonly<Record<string, string>> = { risingbeyondborders: "rbb" };
/* The production R2 bucket(s). */
export const PRODUCTION_BUCKETS: readonly string[] = ["rbb"];

export type TargetKind = "production" | "test" | "unclassified" | "none";

export interface Target {
  kind: TargetKind;
  database: string | null;
  bucket: string | null;
  productionBucket: boolean;
}

export const isProductionDatabase = (name: string | null | undefined) => Boolean(name && Object.hasOwn(PRODUCTION_DATABASES, name));
export const isProductionBucket = (name: string | null | undefined) => Boolean(name && PRODUCTION_BUCKETS.includes(name));
export const isTestDatabase = (name: string | null | undefined) => Boolean(name && /_test$/.test(name) && !isProductionDatabase(name));

export function targetOf({ database, bucket }: { database?: string | null; bucket?: string | null }): Target {
  const db = database?.trim() || null;
  const b = bucket?.trim() || null;
  return {
    kind: !db ? "none" : isProductionDatabase(db) ? "production" : isTestDatabase(db) ? "test" : "unclassified",
    database: db,
    bucket: b,
    productionBucket: isProductionBucket(b),
  };
}

/* The configuration's own consistency, by variable name (env.ts reports
   them like every other configuration problem — before anything
   connects). */
export function targetProblems(env: { MONGODB_DB?: string; R2_BUCKET?: string; RBB_TARGET?: string; ORGANIZATION_ID?: string }): { name: string; message: string }[] {
  const problems: { name: string; message: string }[] = [];
  const target = targetOf({ database: env.MONGODB_DB, bucket: env.R2_BUCKET });
  const deliberate = env.RBB_TARGET === "production";
  if (target.kind === "production") {
    if (!deliberate) problems.push({ name: "RBB_TARGET", message: "must be production: MONGODB_DB is the production database, and production is only ever used on purpose" });
    const org = PRODUCTION_DATABASES[target.database!]!;
    if (!env.ORGANIZATION_ID) problems.push({ name: "ORGANIZATION_ID", message: `is required with the production database (it serves "${org}")` });
    else if (env.ORGANIZATION_ID !== org) problems.push({ name: "ORGANIZATION_ID", message: `must be "${org}" with the production database` });
    if (target.bucket && !target.productionBucket) problems.push({ name: "R2_BUCKET", message: "must be the production bucket with the production database" });
  } else {
    if (deliberate) problems.push({ name: "RBB_TARGET", message: "is production, but MONGODB_DB is not the production database" });
    if (target.productionBucket) problems.push({ name: "R2_BUCKET", message: "is the production bucket; only the production database may use it" });
  }
  if (env.RBB_TARGET === "test" && target.kind !== "test") problems.push({ name: "RBB_TARGET", message: 'is test, but MONGODB_DB does not end in "_test"' });
  return problems;
}

/* The namespace new media objects are filed under (media/policy.ts
   newObjectKey: "_development/" or "_test/" outside production). It
   follows the TARGET: the production database's media is never filed
   under "_development/", whatever NODE_ENV says — and a non-production
   database never uses the production bucket at all (targetProblems). */
export const mediaKeyEnv = <E extends string>(env: E, target: Target): E | "production" => (target.kind === "production" ? "production" : env);

/* The one confirmation that lets a maintenance command touch production:
   the production database's name, typed — `--production=<database>`.
   A generic --confirm never does. */
export const productionFlag = (database: string) => `--production=${database}`;

export type ScriptPurpose =
  /* Deliberate maintenance (indexes, the first settings, scheduled
     publishing, media housekeeping): production only with the typed
     confirmation. */
  | "maintenance"
  /* Tests, smoke servers and test cleanup: the test database only — no
     flag changes that. */
  | "test";

/* Why a command must not run against `target`, or [] when it may. Called
   after the configuration is loaded and BEFORE anything connects. */
export function scriptTargetProblems(target: Target, purpose: ScriptPurpose, argv: readonly string[]): string[] {
  if (purpose === "test") {
    const problems: string[] = [];
    if (target.kind !== "test") problems.push(`test tooling runs only against a test database (a name ending in "_test"); this target is ${describeTarget(target)}`);
    if (target.productionBucket) problems.push("test tooling never uses the production bucket");
    return problems;
  }
  if (target.kind === "production" && !argv.includes(productionFlag(target.database!)))
    return [`this is the PRODUCTION database. To run this against it on purpose, add ${productionFlag(target.database!)} (a generic --confirm is not enough)`];
  return [];
}

export const describeTarget = (target: Target) =>
  target.kind === "none" ? "no database" : `the ${target.kind} database "${target.database}"`;
