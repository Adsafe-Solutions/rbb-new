import type { Config } from "../src/config/env.ts";
import { FORMS_OFF } from "../src/modules/forms/config.ts";
import type { MongoProvider } from "../src/db/mongo.ts";
import { TEST_ORG } from "./fixtures/appeal.ts";

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  env: "test",
  orgId: TEST_ORG,
  mongo: null,
  cors: { origins: ["https://site.example", "https://admin.example"], web: "https://site.example" },
  logLevel: "debug",
  auth: {
    secret: "test-only-auth-secret-0123456789abcdef",
    secretIsEphemeral: false,
    cookie: { name: "cms_session", sameSite: "Strict", secure: false },
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  },
  integrations: { givebutter: null },
  storage: null,
  deployHookUrl: null,
  scheduler: null,
  forms: FORMS_OFF,
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
