import { MongoClient, type Db, type MongoClientOptions } from "mongodb";
import { errors } from "../errors.ts";

/* The MongoDB connection — ONE client per process, created on first use
   and reused by every request after it.

   On Vercel a function instance stays warm between invocations, and module
   state survives with it, so a warm request finds the client already
   connected: no connect → query → disconnect per request. The cache lives
   on globalThis so a module re-evaluated in the same process (dev reloads)
   still finds it. A failed connect is removed from the cache, so the next
   request tries again instead of inheriting the failure.

   The connection string is a secret: it is held only in memory, never
   logged and never put into an error. A failure reaches the client as
   SERVICE_UNAVAILABLE with a generic message. */

export interface MongoSettings {
  uri: string;
  dbName: string;
}

export interface MongoProvider {
  /* The configured database; throws SERVICE_UNAVAILABLE if unreachable. */
  db(): Promise<Db>;
  /* Resolves when the database answers a ping; throws otherwise. */
  ping(): Promise<void>;
  /* Closes this provider's client (scripts and tests). */
  close(): Promise<void>;
}

export const CLIENT_OPTIONS: MongoClientOptions = {
  appName: "rbb-api",
  /* Serverless instances are many and short-lived: keep each pool small. */
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  /* Fail fast when the database is unreachable instead of holding a
     request for the driver's 30-second default. */
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
  /* A field set to undefined is left out, never stored as null. */
  ignoreUndefined: true,
};

type ClientFactory = (uri: string) => Pick<MongoClient, "connect" | "db" | "close">;

interface CacheEntry {
  client: ReturnType<ClientFactory>;
  ready: Promise<ReturnType<ClientFactory>>;
}

const CACHE = Symbol.for("rbb.api.mongo-clients");
const cache = (): Map<string, CacheEntry> => {
  const holder = globalThis as typeof globalThis & { [CACHE]?: Map<string, CacheEntry> };
  return (holder[CACHE] ??= new Map());
};

export function createMongoProvider(
  settings: MongoSettings,
  { createClient = (uri: string) => new MongoClient(uri, CLIENT_OPTIONS) }: { createClient?: ClientFactory } = {}
): MongoProvider {
  const connect = () => {
    const clients = cache();
    const existing = clients.get(settings.uri);
    if (existing) return existing.ready;

    const client = createClient(settings.uri);
    const ready = client.connect().then(
      () => client,
      (cause: unknown) => {
        if (clients.get(settings.uri)?.client === client) clients.delete(settings.uri);
        throw errors.unavailable("The database is unavailable.", cause);
      }
    );
    clients.set(settings.uri, { client, ready });
    return ready;
  };

  const db = async () => (await connect()).db(settings.dbName) as Db;

  return {
    db,
    async ping() {
      await (await db()).command({ ping: 1 }, { timeoutMS: 2_000 });
    },
    async close() {
      const clients = cache();
      const entry = clients.get(settings.uri);
      if (!entry) return;
      clients.delete(settings.uri);
      await entry.client.close();
    },
  };
}

/* Errors that mean "the database could not be reached", as opposed to a
   problem with the query. */
export const isDatabaseUnavailable = (error: unknown) =>
  error instanceof Error && /^Mongo(ServerSelection|Network|NotConnected|Topology)/.test(error.name);

/* A unique index refused a write. `field` names the indexed field that
   clashed — never the value. */
export class DuplicateKeyError extends Error {
  readonly field: string;
  constructor(field: string) {
    super(`Duplicate value for ${field}`);
    this.name = "DuplicateKeyError";
    this.field = field;
  }
}

export function asDuplicateKey(error: unknown): DuplicateKeyError | null {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== 11000) return null;
  const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
  const field = Object.keys(pattern).find((key) => key !== "orgId") ?? "key";
  return new DuplicateKeyError(field);
}
