import { z } from "zod";
import { OrgId } from "@rbb/content-schema";

/* The API's configuration — read from the environment ONCE, validated, and
   the only place in the API that touches process.env (apart from PORT in
   the local dev server). On Vercel the values come from the project's
   environment settings; locally from apps/api/.env.local (git-ignored).

   Problems are reported by variable NAME, never by value, so a
   configuration report is always safe to log. */

/* What each variable is. `secret` values are never logged or returned;
   `requiredIn` says where a missing value is an error. */
export const ENV_VARIABLES = {
  NODE_ENV: { secret: false, requiredIn: "never", purpose: "development | test | production (default development)" },
  ORGANIZATION_ID: { secret: false, requiredIn: "production", purpose: "the organization this deployment serves (orgId of every record)" },
  MONGODB_URI: { secret: true, requiredIn: "production", purpose: "MongoDB connection string" },
  MONGODB_DB: { secret: false, requiredIn: "production", purpose: "MongoDB database name (required whenever MONGODB_URI is set)" },
  WEB_ORIGIN: { secret: false, requiredIn: "never", purpose: "the public site's origin, allowed by CORS" },
  ADMIN_ORIGIN: { secret: false, requiredIn: "never", purpose: "the admin's origin, allowed by CORS" },
  LOG_LEVEL: { secret: false, requiredIn: "never", purpose: "debug | info | warn | error (default info)" },
} as const;

export type EnvName = keyof typeof ENV_VARIABLES;
export type AppEnv = "development" | "test" | "production";

export interface Config {
  env: AppEnv;
  orgId: string;
  /* null: no database configured (allowed outside production only). */
  mongo: { uri: string; dbName: string } | null;
  cors: { origins: string[] };
  logLevel: "debug" | "info" | "warn" | "error";
}

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid configuration: ${problems.length} problem(s)`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

/* The organization used when ORGANIZATION_ID is unset — outside production
   only. Production must say which organization it serves. */
const DEVELOPMENT_ORG_ID = "rbb";

const isOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
};

const Origin = z.string().refine(isOrigin, "must be an origin like https://www.example.org (no path or trailing slash)");

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ORGANIZATION_ID: OrgId.optional(),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://")
      .refine((uri) => !/[<>]/.test(uri), "still contains <placeholders> instead of real credentials")
      .optional(),
    MONGODB_DB: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,63}$/, "must be letters, digits, '-' or '_' (max 63)")
      .optional(),
    WEB_ORIGIN: Origin.optional(),
    ADMIN_ORIGIN: Origin.optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    const need = (name: EnvName, message: string) => ctx.addIssue({ code: "custom", path: [name], message });
    if (env.MONGODB_URI && !env.MONGODB_DB) need("MONGODB_DB", "is required when MONGODB_URI is set");
    if (env.MONGODB_DB && !env.MONGODB_URI) need("MONGODB_URI", "is required when MONGODB_DB is set");
    if (env.NODE_ENV !== "production") return;
    for (const name of Object.keys(ENV_VARIABLES) as EnvName[])
      if (ENV_VARIABLES[name].requiredIn === "production" && !env[name]) need(name, "is required in production");
    for (const name of ["WEB_ORIGIN", "ADMIN_ORIGIN"] as const)
      if (env[name] && !env[name].startsWith("https://")) need(name, "must be an https:// origin in production");
  });

/* Only the variables the API knows, with "" meaning unset. */
const pick = (source: Record<string, string | undefined>) =>
  Object.fromEntries(
    (Object.keys(ENV_VARIABLES) as EnvName[]).map((name) => {
      const value = source[name]?.trim();
      return [name, value ? value : undefined];
    })
  );

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const result = EnvSchema.safeParse(pick(source));
  if (!result.success)
    /* `issue.message` is ours or Zod's generic text — neither repeats the
       value — and the path is the variable's name. */
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`));

  const env = result.data;
  return {
    env: env.NODE_ENV,
    orgId: env.ORGANIZATION_ID ?? DEVELOPMENT_ORG_ID,
    mongo: env.MONGODB_URI && env.MONGODB_DB ? { uri: env.MONGODB_URI, dbName: env.MONGODB_DB } : null,
    cors: { origins: [env.WEB_ORIGIN, env.ADMIN_ORIGIN].filter((o): o is string => Boolean(o)) },
    logLevel: env.LOG_LEVEL,
  };
}

/* Which variables are set — names only, for the startup log. */
export function describeEnvironment(source: Record<string, string | undefined> = process.env) {
  const names = Object.keys(ENV_VARIABLES) as EnvName[];
  return {
    present: names.filter((name) => source[name]?.trim()),
    missing: names.filter((name) => !source[name]?.trim()),
  };
}
