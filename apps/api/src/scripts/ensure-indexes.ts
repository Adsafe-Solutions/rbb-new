import { ConfigError, loadConfig } from "../config/env.ts";
import { createMongoProvider } from "../db/mongo.ts";
import { COLLECTIONS, ensureIndexes } from "../db/collections.ts";
import { guardTarget } from "./target-guard.ts";

/* Creates the indexes the API needs (src/db/collections.ts) in the
   configured database. Safe to run any number of times: it only ever ADDS
   a missing index — it never drops, rebuilds or deletes anything.

   Against the production database (config/target.ts — whatever NODE_ENV
   says) it asks for the database's name, typed: --production=<database>,
   so it is never run there by accident. Output names collections and
   indexes only. */
try {
  const config = loadConfig();
  if (!config.mongo) throw new ConfigError(["MONGODB_URI and MONGODB_DB are required to create indexes"]);
  guardTarget(config, "maintenance");
  const mongo = createMongoProvider(config.mongo);
  try {
    const created = await ensureIndexes(await mongo.db());
    console.log(`Indexes ensured in the ${config.target.kind} database (${Object.keys(COLLECTIONS).length} collection(s)):`);
    for (const [collection, names] of Object.entries(created)) console.log(`  ${collection}: ${names.join(", ")}`);
  } finally {
    await mongo.close();
  }
} catch (error) {
  if (error instanceof ConfigError) console.error(`Configuration problems:\n  ${error.problems.join("\n  ")}`);
  else console.error(`Could not ensure indexes: ${(error as Error).name}`);
  process.exit(1);
}
