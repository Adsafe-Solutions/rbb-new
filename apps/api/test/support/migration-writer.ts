import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { CLIENT_OPTIONS } from "../../src/db/mongo.ts";
import { R2Storage } from "../../src/modules/media/r2.ts";
import { silentLog } from "../auth/memory.ts";
import { member } from "../media/memory.ts";
import { startFakeR2 } from "./fake-r2.ts";
import { previewSnapshot } from "./migration/fidelity.ts";
import { mongoServices, serviceClient, testMedia } from "./migration/services.ts";
import { REHEARSAL_DATABASE, REHEARSAL_ORGANIZATION, databaseProblems, rehearsalTargetProblems } from "./migration/target.ts";
import { COLLECTION_TYPES, PAGE_TYPES, manifestProblems, newLedger, replay, type Ledger, type Manifest } from "./migration/writer.ts";

/* TEST-ONLY migration writer — a rehearsal, never a migration:

     MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test \
       node apps/api/test/support/migration-writer.ts --manifest=<rehearsal manifest> --report=<ledger.json> [--snapshot=<preview.json>]

   Writes the manifest's eligible records (migration/writer.ts) as DRAFTS
   into the reserved test database as the reserved test organization —
   "risingbeyondborders_test" and "test-org", by exact name, confirmed
   read-only after connecting — through the API's services, with media
   in a local FAKE R2 only. It never submits, approves, publishes,
   schedules or activates; it never overwrites.

   --report    the ledger: created ids (all runs), skipped items and why,
               existing records and their differences. Written after every
               create, so an interrupted run leaves a true record; a rerun
               with the same ledger skips what is already there. It is the
               ONLY list a cleanup of this rehearsal may use.
   --snapshot  also compute, IN MEMORY, the snapshot the website would draw
               from these records (migration/fidelity.ts) and write it as
               { data } — for a scratch website build. Nothing is stored.

   Refused before anything is read or connected: any other option —
   --confirm, --production…, --org, --database, --apply, --publish … — and
   any target that is not exactly the reserved test database. There is no
   override. Prints names and counts, never a connection string. */

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const KNOWN = new Set(["--manifest", "--report", "--snapshot"]);

export function parseArgs(argv: string[]): { manifest: string; report: string; snapshot?: string } {
  const options: Record<string, string> = {};
  for (const arg of argv) {
    const [name, ...rest] = arg.split("=");
    if (!KNOWN.has(name!) || !rest.length) throw new Error(`refused: "${name}" — this writer takes only --manifest=, --report= and --snapshot= (it writes the reserved test database only; nothing overrides that)`);
    options[name!.slice(2)] = rest.join("=");
  }
  if (!options.manifest || !options.report) throw new Error("refused: --manifest=<path> and --report=<path> are required");
  return options as { manifest: string; report: string; snapshot?: string };
}

const save = (path: string, value: unknown) => {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
};

export async function main(argv = process.argv.slice(2), env: Record<string, string | undefined> = process.env): Promise<number> {
  /* 1. Options and target, before reading or connecting to anything. */
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }
  const uri = env.MONGODB_TEST_URI?.trim();
  const database = env.MONGODB_TEST_DB?.trim();
  const refused = [...(uri ? [] : ["MONGODB_TEST_URI is not set"]), ...rehearsalTargetProblems({ database, organization: REHEARSAL_ORGANIZATION })];
  if (refused.length) {
    console.error(`Refused: ${refused.join("; ")}. Nothing was read or written.`);
    return 2;
  }

  /* 2. The manifest, and any earlier ledger for it. */
  const manifest = JSON.parse(readFileSync(resolve(options.manifest), "utf8")) as Manifest;
  const problems = manifestProblems(manifest);
  if (problems.length) {
    console.error(`Refused: the manifest is not valid:\n  ${problems.join("\n  ")}`);
    return 2;
  }
  const reportPath = resolve(options.report);
  let ledger: Ledger = newLedger({ database: REHEARSAL_DATABASE, organization: REHEARSAL_ORGANIZATION }, manifest);
  if (existsSync(reportPath)) {
    const earlier = JSON.parse(readFileSync(reportPath, "utf8")) as Ledger;
    if (earlier.target?.database !== REHEARSAL_DATABASE || earlier.target?.organization !== REHEARSAL_ORGANIZATION || earlier.manifest?.sourceHash !== manifest.sourceHash) {
      console.error("Refused: the existing report belongs to another target or another manifest. Use a new --report path. Nothing was written.");
      return 2;
    }
    ledger = earlier;
  }

  /* 3. Connect, and confirm read-only that this is the dedicated test database. */
  const client = new MongoClient(uri!, { ...CLIENT_OPTIONS, serverSelectionTimeoutMS: 15_000, appName: "rbb-migration-rehearsal-writer" });
  const fake = await startFakeR2({ origins: [] });
  try {
    try {
      await client.connect();
    } catch (error) {
      console.error(`Refused: could not reach the test database (${(error as Error).name}). Nothing was written.`);
      return 2;
    }
    const db = client.db(REHEARSAL_DATABASE);
    const found = await databaseProblems(db as never);
    if (found.length) {
      console.error(`Refused: ${found.join("; ")}. Nothing was written.`);
      return 2;
    }
    console.log(`Target: database "${REHEARSAL_DATABASE}" (test, confirmed: reserved test records only), organization "${REHEARSAL_ORGANIZATION}", media: fake R2 (local, in memory).`);

    /* 4. The API's services, as an owner of the test organization only. */
    const secret = randomBytes(32).toString("hex");
    /* A fixed actor id, so the rehearsal's audit entries are recognisable. */
    const auth = member(REHEARSAL_ORGANIZATION, "OWNER", "7e57a11e-0000-4000-8000-00000000c0de");
    const services = mongoServices(db, REHEARSAL_ORGANIZATION, { secret, log: silentLog as never });
    const storage = new R2Storage({ endpoint: fake.url, bucket: fake.bucket, credentials: fake.credentials, publicBaseUrl: fake.publicBaseUrl });
    const writer = serviceClient(services as never, auth, testMedia(db, REHEARSAL_ORGANIZATION, storage, auth, { secret, log: silentLog as never }));

    const result = await replay({
      manifest,
      client: writer,
      ledger,
      readFile: (file) => readFile(resolve(ROOT, file)),
      onProgress: async (l) => save(reportPath, l),
    });
    const thisRun = result.created.filter((c) => c.run === result.runs);
    console.log(`Run ${result.runs}: created ${thisRun.length} draft(s) — ${thisRun.map((c) => c.key).join(", ") || "none"}`);
    console.log(`Already there (not touched): ${result.existing.length}${result.existing.length ? ` — ${result.existing.map((e) => `${e.key}${e.createdByRehearsal ? " (an earlier run)" : ""}${e.differs.length ? ` differs: ${e.differs.join(", ")}` : ""}`).join("; ")}` : ""}`);
    console.log(`Skipped: ${result.skipped.length} (reasons in the report)`);
    console.log(`Media uploaded to the fake R2 this run: ${result.media.filter((m) => m.run === result.runs).length}`);
    console.log(`Report: ${reportPath}`);

    /* 5. The in-memory preview, from what the test database now holds. */
    if (options.snapshot) {
      const collections = Object.fromEntries(await Promise.all(COLLECTION_TYPES.map(async (t) => [t, await writer.list(t)])));
      const pages = Object.fromEntries(await Promise.all(PAGE_TYPES.map(async (t) => [t, await writer.page(t)])));
      const media = await db.collection("media").find({ orgId: REHEARSAL_ORGANIZATION, deletedAt: null, status: "ready" }, { projection: { _id: 0 } }).toArray();
      const { snapshot, problems: previewProblems } = await previewSnapshot({ collections, pages, media: media as never }, REHEARSAL_ORGANIZATION);
      if (!snapshot) {
        console.error(`No preview snapshot: ${previewProblems.join("; ")}`);
        return 1;
      }
      save(resolve(options.snapshot), { data: snapshot });
      console.log(`Preview snapshot (in memory, never stored): ${resolve(options.snapshot)} — content: ${Object.keys(snapshot.content).join(", ") || "none"}`);
    }
    return 0;
  } finally {
    await client.close();
    await fake.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await main();
