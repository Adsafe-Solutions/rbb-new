import { MongoClient } from "mongodb";
import { ConfigError, loadConfig } from "../config/env.ts";
import { CLIENT_OPTIONS, createMongoProvider } from "../db/mongo.ts";
import { ensureIndexes } from "../db/collections.ts";
import { createLogger } from "../logging/logger.ts";
import { AuditService, mongoAuditStore } from "../modules/audit/audit.ts";
import { BootstrapRefused, bootstrapOwner } from "../modules/auth/bootstrap.ts";
import { bootstrapTargetProblems, isAtlas, passwordSource, setupState, setupStateProblems } from "../modules/auth/bootstrap-setup.ts";
import { mongoAuthStores } from "../modules/auth/repository.ts";

/* Creates the FIRST owner of the configured organization — once, on
   purpose (M25.1). For the real database, from the repo root:

     pnpm api:owner:setup -- --check     read-only: the target and its state
     pnpm api:owner:setup                indexes (if asked), then the owner

   `owner:setup` loads apps/api/.env (the database) and then
   apps/api/.env.bootstrap (git-ignored, written by the operator), and
   clears any MONGODB_*, ORGANIZATION_ID, NODE_ENV, BOOTSTRAP_OWNER_PASSWORD
   or BOOTSTRAP_ALLOW_TEST_TARGET the shell carries — never .env.local, so
   the password can only be typed at the prompt. .env.bootstrap holds:

     BOOTSTRAP_OWNER_ENABLED=true          the opt-in; anything else refuses
     BOOTSTRAP_OWNER_EMAIL / _NAME         the owner
     BOOTSTRAP_TARGET_DB / _ORG            the exact database and organization
                                           this is for; a mismatch refuses
     BOOTSTRAP_ENSURE_INDEXES=true         create missing indexes first
                                           (only ever adds; never drops)

   The password is typed at a hidden prompt, twice — or, with no terminal,
   read from BOOTSTRAP_OWNER_PASSWORD (then removed from this process's
   environment). It is never printed, logged or an argument. It is hashed
   by bootstrapOwner (scrypt), which also refuses an existing owner or
   account. Before ANY write the target is checked (bootstrap-setup.ts: never
   a test or smoke database, Atlas only, exactly the stated target) and then
   read: an existing owner or account stops it, nothing changed. Requires
   --confirm (or --check). Never runs on build or startup. */

function hiddenPrompt(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          return reject(new Error("Cancelled"));
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const args = process.argv.slice(2);
const check = args.includes("--check");
/* Read once, then gone from the environment (child processes, crash dumps). */
const envPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;
delete process.env.BOOTSTRAP_OWNER_PASSWORD;

async function readPassword(): Promise<string> {
  const source = passwordSource({ fromEnv: envPassword, isTTY: Boolean(process.stdin.isTTY) });
  if (source === "env") return envPassword!;
  if (source === null) throw new BootstrapRefused("No terminal to prompt in, and no BOOTSTRAP_OWNER_PASSWORD. Nothing was changed.");
  const first = await hiddenPrompt("Owner password (hidden, 12+ characters): ");
  const second = await hiddenPrompt("Repeat password: ");
  if (first !== second) throw new BootstrapRefused("The passwords do not match. Nothing was changed.");
  return first;
}

try {
  if (!check && !args.includes("--confirm")) throw new BootstrapRefused("Refusing to run without --confirm (or --check). Nothing was changed.");
  const config = loadConfig();
  if (!config.mongo) throw new ConfigError(["MONGODB_URI and MONGODB_DB are required"]);
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim();
  const name = process.env.BOOTSTRAP_OWNER_NAME?.trim();
  if (!email || !name) throw new BootstrapRefused("Set BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_NAME. Nothing was changed.");
  const ensure = process.env.BOOTSTRAP_ENSURE_INDEXES === "true";

  /* 1. The target, before connecting. */
  console.log(`Target: mode=${config.env} organization=${config.orgId} database=${config.mongo.dbName} host=${isAtlas(config.mongo.uri) ? "Atlas" : "not Atlas"}`);
  const targetProblems = bootstrapTargetProblems({ uri: config.mongo.uri, dbName: config.mongo.dbName, orgId: config.orgId, env: process.env });
  if (targetProblems.length) throw new BootstrapRefused(`Refusing this target:\n  - ${targetProblems.join("\n  - ")}\nNothing was changed.`);

  /* 2. A read-only look at it, immediately before any write. */
  const client = new MongoClient(config.mongo.uri, { ...CLIENT_OPTIONS, serverSelectionTimeoutMS: 10_000 });
  let state;
  try {
    await client.connect();
    const db = client.db(config.mongo.dbName);
    state = await setupState(db, async () => (await client.db("admin").admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name), { orgId: config.orgId, email });
  } finally {
    await client.close();
  }
  console.log(`State: database ${state.databaseExists ? "exists" : "does not exist yet"}, ${state.collections} collection(s), owners in "${config.orgId}": ${state.owners}, account for this email: ${state.emailTaken ? "yes" : "no"}, unique indexes: ${state.uniqueIndexes ? "present" : "missing"}`);
  const stateProblems = setupStateProblems(state, { ensureIndexes: ensure });
  if (stateProblems.length) throw new BootstrapRefused(`Stopping:\n  - ${stateProblems.join("\n  - ")}\nNothing was changed.`);
  if (check) {
    console.log(`Check passed (read-only, nothing was changed). Running without --check would ${ensure ? "create any missing indexes, then " : ""}prompt for a password and create the owner ${email} in "${config.orgId}".`);
    process.exit(0);
  }

  const mongo = createMongoProvider(config.mongo);
  try {
    const db = await mongo.db();
    /* 3. Indexes, when asked: only ever adds what is missing. */
    if (ensure) {
      const created = await ensureIndexes(db);
      console.log(`Indexes ensured on ${Object.keys(created).length} collection(s).`);
    } else if (!state.uniqueIndexes) throw new BootstrapRefused("Missing unique indexes on users/memberships. Nothing was changed.");
    /* 4. The owner — bootstrapOwner hashes the password and re-checks owner and account. */
    const password = await readPassword();
    const log = createLogger({ level: "warn" });
    const audit = new AuditService(mongoAuditStore(db, config.orgId), { orgId: config.orgId, secret: config.auth.secret, log });
    const { userId } = await bootstrapOwner(mongoAuthStores(db, config.orgId), audit, {
      orgId: config.orgId,
      input: { email, name, password },
    });
    console.log(`Owner created for organization "${config.orgId}" in ${config.mongo.dbName} (user ${userId}). Now delete apps/api/.env.bootstrap (or set BOOTSTRAP_OWNER_ENABLED=false).`);
  } finally {
    await mongo.close();
  }
} catch (error) {
  if (error instanceof BootstrapRefused) console.error(error.message);
  else if (error instanceof ConfigError) console.error(`Configuration problems:\n  ${error.problems.join("\n  ")}`);
  else console.error(`Owner setup failed: ${(error as Error).name}. Nothing beyond what is reported above was changed.`);
  process.exit(1);
}
