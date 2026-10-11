import { readFile } from "node:fs/promises";
import { ConfigError, loadConfig } from "../config/env.ts";
import { createMongoProvider } from "../db/mongo.ts";
import { createLogger } from "../logging/logger.ts";
import { AuditService, mongoAuditStore } from "../modules/audit/audit.ts";
import { MongoMediaStore } from "../modules/media/repository.ts";
import { MongoSettingsStore } from "../modules/settings/repository.ts";
import { SettingsService } from "../modules/settings/service.ts";
import { guardTarget } from "./target-guard.ts";

/* Creates the organization's FIRST settings record from a file — the
   website's current settings, exported by the web app:

     pnpm --filter @rbb/web run export:settings
     pnpm api:settings:import -- --file apps/web/build-meta/site-settings.json [--production=<database>]

   · validated against the content contract; the organization, id, status
     and timestamps are this deployment's, whatever the file says
   · creates only — if settings already exist it changes nothing (edit them
     in the admin instead)
   · nothing is published: an owner reviews and publishes in the admin
   · the production database (config/target.ts — whatever NODE_ENV says)
     needs its name, typed: --production=<database>
   Output: what happened and any problems by field path — never values. */
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
try {
  if (!file) throw new ConfigError(["--file <path to the exported site-settings.json> is required"]);
  const config = loadConfig();
  if (!config.mongo) throw new ConfigError(["MONGODB_URI and MONGODB_DB are required"]);
  guardTarget(config, "maintenance", args);
  const record = JSON.parse(await readFile(file, "utf8"));
  if (record?.orgId && record.orgId !== config.orgId) throw new ConfigError([`the file is for organization "${record.orgId}", this deployment serves "${config.orgId}"`]);
  const mongo = createMongoProvider(config.mongo);
  try {
    const db = await mongo.db();
    const log = createLogger({ level: config.logLevel, base: { service: "rbb-settings-import", env: config.env } });
    const audit = new AuditService(mongoAuditStore(db, config.orgId), { orgId: config.orgId, secret: config.auth.secret, log });
    const service = new SettingsService(new MongoSettingsStore(db, config.orgId), new MongoMediaStore(db, config.orgId), audit, { orgId: config.orgId });
    const { created, problems } = await service.importInitial(record, { id: null, name: "Settings import" });
    if (problems.length) {
      console.error(`The file is not valid site settings:\n  ${problems.map((p) => `${p.path || "(record)"}: ${p.message}`).join("\n  ")}`);
      process.exit(1);
    }
    console.log(created ? `Imported the site settings for "${config.orgId}" (${config.env}). Review and publish them in the admin.` : `Settings for "${config.orgId}" already exist — nothing changed.`);
  } finally {
    await mongo.close();
  }
} catch (error) {
  if (error instanceof ConfigError) console.error(`Problems:\n  ${error.problems.join("\n  ")}`);
  else console.error(`Settings import failed: ${(error as Error).name}`);
  process.exit(1);
}
