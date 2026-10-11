/* The records that already exist, for the rehearsal to match by key —
   READ-ONLY, and only on an explicit choice:

     none                (default) nothing is read; the manifest says
                         existing records were not checked
     file:<path>         a JSON file in this module's `existing` shape
     test                the dedicated test database: MONGODB_TEST_URI +
                         MONGODB_TEST_DB (a name ending in "_test"),
                         organization --org (default test-org)
     production          the production database, as the API's deliberate
                         CMS configuration names it (apps/api/.env.local,
                         or RBB_REHEARSAL_API_ENV): it must load as the
                         production target (RBB_TARGET=production,
                         ORGANIZATION_ID=rbb — apps/api config/target.ts)

   Fails closed: a target that is not positively what was asked for is
   refused before connecting, and a database that turns out to be empty
   or missing is refused after a read-only look. The connection is used
   for find() and countDocuments() only — never a write, an index or a
   command that changes anything. Nothing printed names a host or a
   credential. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { isTestDatabase, targetOf } from "../../../api/src/config/target.ts";
import { loadConfig } from "../../../api/src/config/env.ts";

const API = fileURLToPath(new URL("../../../api/", import.meta.url));

export class RehearsalRefused extends Error {
  name = "RehearsalRefused";
}

/* Which database to read, decided BEFORE connecting. Never returns a
   target it cannot name positively. */
export function readTarget(mode, { env = process.env, org, apiEnvFile = env.RBB_REHEARSAL_API_ENV ?? `${API}.env.local` } = {}) {
  if (mode === "test") {
    const uri = env.MONGODB_TEST_URI?.trim();
    const database = env.MONGODB_TEST_DB?.trim();
    if (!uri || !database) throw new RehearsalRefused("--existing=test needs MONGODB_TEST_URI and MONGODB_TEST_DB (the dedicated test database)");
    if (!isTestDatabase(database) || targetOf({ database }).kind !== "test") throw new RehearsalRefused(`--existing=test reads only a test database (a name ending in "_test"); "${database}" is not one`);
    return { uri, database, organization: org ?? "test-org", kind: "test" };
  }
  if (mode === "production") {
    let vars;
    try {
      vars = parseEnv(readFileSync(apiEnvFile, "utf8"));
    } catch {
      throw new RehearsalRefused("--existing=production needs the API's deliberate CMS configuration (apps/api/.env.local), which could not be read");
    }
    let config;
    try {
      config = loadConfig(vars);
    } catch (error) {
      throw new RehearsalRefused(`the API configuration is not valid, so its target cannot be identified: ${(error.problems ?? [error.name]).join("; ")}`);
    }
    if (config.target.kind !== "production" || !config.mongo)
      throw new RehearsalRefused(`--existing=production reads only the production database; this configuration names ${config.target.database ? `the ${config.target.kind} database "${config.target.database}"` : "no database"}`);
    if (org && org !== config.orgId) throw new RehearsalRefused(`the production database serves "${config.orgId}", not "${org}"`);
    return { uri: config.mongo.uri, database: config.mongo.dbName, organization: config.orgId, kind: "production" };
  }
  throw new RehearsalRefused(`unknown --existing=${mode}`);
}

/* Stores read, by planner type. */
const PAGE_STORES = {
  settings: "site_settings", homepage: "homepages", about: "about_pages", impact: "impact_pages", transparency: "transparency_pages",
  careers: "careers_pages", general_donation: "general_donation_pages", announcement_bar: "announcement_bars", popup: "popups",
};
const COLLECTION_STORES = {
  program: ["programs"], metric: ["metrics"], project: ["projects"], team_member: ["team_members"],
  story: ["posts", "story"], news: ["posts", "news"], blog: ["posts", "blog"], event: ["events"], report: ["reports"], appeal: ["appeals"],
};

/* The read itself — find() only, on the given organization. `db` is any
   object with collection(name).find/countDocuments (the driver's Db, or
   a fake in tests). */
export async function readExistingFrom(db, organization) {
  const view = (d) => ({ id: d.record?.id, slug: d.record?.slug, status: d.record?.status, revision: d.revision ?? null, record: d.record });
  const collections = {};
  for (const [type, [store, postType]] of Object.entries(COLLECTION_STORES)) {
    const filter = { orgId: organization, ...(postType && { "record.type": postType }) };
    collections[type] = (await db.collection(store).find(filter, { projection: { _id: 0, record: 1, revision: 1 } }).toArray()).map(view).sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  }
  const pages = {};
  for (const [type, store] of Object.entries(PAGE_STORES)) {
    const docs = await db.collection(store).find({ orgId: organization }, { projection: { _id: 0, record: 1, revision: 1 } }).toArray();
    pages[type] = docs[0] ? { ...view(docs[0]), id: docs[0].record?.id } : null;
  }
  /* Milestone 9: the Get Involved pages, by their page id (find only). */
  const getInvolved = {};
  for (const d of await db.collection("get_involved_pages").find({ orgId: organization }, { projection: { _id: 0, pageId: 1, record: 1, revision: 1 } }).toArray()) {
    const id = d.pageId ?? d.record?.id;
    if (id) getInvolved[id] = { ...view(d), id };
  }
  const media = (await db.collection("media").find({ orgId: organization, deletedAt: null }, { projection: { _id: 0, id: 1, originalFilename: 1, size: 1, status: 1 } }).toArray())
    .map((m) => ({ id: m.id, originalFilename: m.originalFilename, size: m.size, status: m.status }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { collections, pages, getInvolved, media };
}

export async function readExisting(mode = "none", options = {}) {
  if (!mode || mode === "none") return { checked: false, source: "none" };
  if (mode.startsWith("file:")) {
    const data = JSON.parse(readFileSync(mode.slice(5), "utf8"));
    return { checked: true, source: "file", ...(data.database && { database: data.database }), collections: data.collections ?? {}, pages: data.pages ?? {}, getInvolved: data.getInvolved ?? {}, media: data.media ?? [] };
  }
  const target = readTarget(mode, options);
  const { MongoClient } = createRequire(`${API}package.json`)("mongodb");
  const client = new MongoClient(target.uri, { serverSelectionTimeoutMS: 15_000, appName: "rbb-migration-rehearsal-readonly", readPreference: "secondaryPreferred" });
  try {
    try {
      await client.connect();
    } catch (error) {
      throw new RehearsalRefused(`could not reach the ${target.kind} database (${error.name}) — nothing was read`);
    }
    const db = client.db(target.database);
    /* Positively the database named: it exists, and holds this
       organization's settings (every configured organization has them). */
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    if (!names.length) throw new RehearsalRefused(`the ${target.kind} database "${target.database}" does not exist on this cluster — refusing rather than guessing`);
    if (target.kind === "production" && (await db.collection("site_settings").countDocuments({ orgId: target.organization })) === 0)
      throw new RehearsalRefused(`"${target.database}" holds no settings for "${target.organization}" — not the production database this was asked for`);
    return { checked: true, source: `${target.kind} (read-only)`, database: target.database, organization: target.organization, ...(await readExistingFrom(db, target.organization)) };
  } finally {
    await client.close();
  }
}
