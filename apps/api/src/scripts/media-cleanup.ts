import { ConfigError, loadConfig } from "../config/env.ts";
import { createMongoProvider } from "../db/mongo.ts";
import { createLogger } from "../logging/logger.ts";
import { AuditService, mongoAuditStore } from "../modules/audit/audit.ts";
import { mongoAuthStores } from "../modules/auth/repository.ts";
import { MEDIA_POLICY } from "../modules/media/policy.ts";
import { R2Storage } from "../modules/media/r2.ts";
import { MongoMediaStore } from "../modules/media/repository.ts";
import { MediaService } from "../modules/media/service.ts";

/* Media housekeeping, on demand (there is no scheduler yet):

     · pending uploads older than an hour are marked failed and any object
       they left is removed
     · storage deletions that failed earlier are retried

   By default it only REPORTS what it would do. --apply does it; against
   production --apply also needs --confirm. It never deletes a database
   record, and it touches only objects that belong to records already
   failed or deleted. Output is counts only. */
const apply = process.argv.includes("--apply");
try {
  const config = loadConfig();
  if (!config.mongo) throw new ConfigError(["MONGODB_URI and MONGODB_DB are required"]);
  if (apply && config.env === "production" && !process.argv.includes("--confirm")) {
    console.error("Refusing to change production media without --confirm.");
    process.exit(1);
  }
  const mongo = createMongoProvider(config.mongo);
  try {
    const db = await mongo.db();
    const store = new MongoMediaStore(db, config.orgId);
    if (!apply) {
      const stale = await store.findStalePending(new Date(Date.now() - MEDIA_POLICY.abandonAfterMs), 1000);
      const deleting = await store.findObjectsToDelete(1000);
      console.log(`Would mark ${stale.length} abandoned upload(s) failed and retry ${deleting.length} storage deletion(s). Run with --apply to do it.`);
    } else {
      if (!config.storage) throw new ConfigError(["the R2_* variables are required to remove objects"]);
      const s = config.storage;
      const log = createLogger({ level: config.logLevel, base: { service: "rbb-media-cleanup", env: config.env } });
      const audit = new AuditService(mongoAuditStore(db, config.orgId), { orgId: config.orgId, secret: config.auth.secret, log });
      const storage = new R2Storage({ endpoint: s.endpoint, bucket: s.bucket, credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey }, publicBaseUrl: s.publicBaseUrl });
      const service = new MediaService(store, storage, audit, mongoAuthStores(db, config.orgId).throttle, { orgId: config.orgId, env: config.env, log });
      const result = await service.cleanup();
      console.log(`Abandoned uploads marked failed: ${result.abandoned}; objects removed: ${result.objectsRemoved}; still to retry: ${result.objectsStillPending}.`);
    }
  } finally {
    await mongo.close();
  }
} catch (error) {
  if (error instanceof ConfigError) console.error(`Configuration problems:\n  ${error.problems.join("\n  ")}`);
  else console.error(`Media cleanup failed: ${(error as Error).name}`);
  process.exit(1);
}
