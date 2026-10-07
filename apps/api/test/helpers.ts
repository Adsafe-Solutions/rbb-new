import type { Config } from "../src/config/env.ts";
import type { MongoProvider } from "../src/db/mongo.ts";
import type { AppealStore, StoredAppeal } from "../src/modules/appeals/repository.ts";
import type { Appeal } from "@rbb/content-schema";
import { DuplicateKeyError } from "../src/db/mongo.ts";
import { TEST_ORG } from "./fixtures/appeal.ts";

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  env: "test",
  orgId: TEST_ORG,
  mongo: null,
  cors: { origins: ["https://site.example", "https://admin.example"] },
  logLevel: "debug",
  ...overrides,
});

/* Collects log lines instead of printing them. */
export const captureLogs = () => {
  const lines: string[] = [];
  return { lines, write: (line: string) => lines.push(line), text: () => lines.join("\n") };
};

/* A response body as test data (Response.json() is typed unknown). */
export const jsonOf = async (response: Response): Promise<any> => response.json();

export const get = (app: { handle(r: Request): Promise<Response> }, path: string, init: RequestInit = {}) =>
  app.handle(new Request(`http://api.test${path}`, init));

/* A database provider whose database is down. */
export const downMongo = (cause = new Error("connect ECONNREFUSED mongodb://user:secret@db.internal:27017")): MongoProvider => ({
  db: async () => {
    throw Object.assign(cause, { name: "MongoServerSelectionError" });
  },
  ping: async () => {
    throw cause;
  },
  close: async () => {},
});

/* In-memory AppealStore with the same contract as MongoAppealStore. */
export class MemoryAppealStore implements AppealStore {
  readonly rows = new Map<string, StoredAppeal>();
  async findBySlug(slug: string) {
    return [...this.rows.values()].find((row) => row.record.slug === slug) ?? null;
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async insert(record: Appeal) {
    if (this.rows.has(record.id)) throw new DuplicateKeyError("id");
    if (await this.findBySlug(record.slug)) throw new DuplicateKeyError("slug");
    const stored = { record: { ...record }, revision: 1 };
    this.rows.set(record.id, stored);
    return stored;
  }
  async replace(id: string, record: Appeal, expectedRevision: number) {
    const row = this.rows.get(id);
    if (!row || row.revision !== expectedRevision) return null;
    const stored = { record: { ...record }, revision: expectedRevision + 1 };
    this.rows.set(id, stored);
    return stored;
  }
}
