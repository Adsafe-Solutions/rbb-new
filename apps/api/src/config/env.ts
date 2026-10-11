import { randomBytes } from "node:crypto";
import { z } from "zod";
import { OrgId } from "@rbb/content-schema";
import { loadFormsConfig, type FormsConfig } from "../modules/forms/config.ts";

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
  AUTH_SECRET: { secret: true, requiredIn: "production", purpose: "server key (32+ chars) for hashing IPs and throttle keys" },
  AUTH_COOKIE_NAME: { secret: false, requiredIn: "never", purpose: "session cookie name (default cms_session)" },
  AUTH_COOKIE_SAMESITE: { secret: false, requiredIn: "never", purpose: "strict | lax | none (default strict; none needs production/https)" },
  AUTH_SESSION_TTL_HOURS: { secret: false, requiredIn: "never", purpose: "absolute session lifetime in hours (default 168 = 7 days)" },
  GIVEBUTTER_API_KEY: { secret: true, requiredIn: "never", purpose: "Givebutter API key (server-side only); unset = donation provider not configured" },
  /* Media storage (Cloudflare R2). All or none: with none, the media
     routes answer 503; with some, the configuration is invalid. */
  R2_ACCOUNT_ID: { secret: false, requiredIn: "never", purpose: "Cloudflare account id that owns the R2 bucket" },
  R2_BUCKET: { secret: false, requiredIn: "never", purpose: "R2 bucket that holds media objects" },
  R2_ACCESS_KEY_ID: { secret: true, requiredIn: "never", purpose: "R2 S3 API access key id (server-side only)" },
  R2_SECRET_ACCESS_KEY: { secret: true, requiredIn: "never", purpose: "R2 S3 API secret access key (server-side only)" },
  R2_PUBLIC_URL: { secret: false, requiredIn: "never", purpose: "the bucket's public origin (custom domain) media is served from" },
  R2_S3_API: { secret: false, requiredIn: "never", purpose: "R2 S3 endpoint (optional; default https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com)" },
  DEPLOY_HOOK_URL: { secret: true, requiredIn: "never", purpose: "build hook POSTed after a publish (Cloudflare Pages / Vercel); unset = no automatic rebuild" },
  CRON_SECRET: { secret: true, requiredIn: "never", purpose: "bearer secret (32+ chars) a cron sends to run scheduled publishing (GET /api/v1/internal/scheduler/run — Vercel Cron sends it itself); unset = scheduler off" },
  /* M18: the public site's forms (Document 21). Parsed by
     modules/forms/config.ts, which fails CLOSED — a problem turns the
     affected form (or every form) off; the rest of the API is unaffected. */
  EMAIL_MODE: { secret: false, requiredIn: "never", purpose: "off | test | staging | live (default off — no form takes submissions)" },
  EMAIL_API_KEY: { secret: true, requiredIn: "never", purpose: "Resend API key for form email (staging/live); a sending-only key restricted to the verified domain" },
  RESEND_API_KEY: { secret: true, requiredIn: "never", purpose: "accepted as an alias of EMAIL_API_KEY" },
  EMAIL_FROM: { secret: false, requiredIn: "never", purpose: "the approved From on the verified domain (a resend.dev sender is refused in live)" },
  EMAIL_TO_CONTACT: { secret: false, requiredIn: "never", purpose: "RBB's approved inbox for the Contact form; unset = form off" },
  EMAIL_TO_VOLUNTEER: { secret: false, requiredIn: "never", purpose: "RBB's approved inbox for the Volunteer form; unset = form off" },
  EMAIL_TO_PARTNER: { secret: false, requiredIn: "never", purpose: "RBB's approved inbox for the Partner form; unset = form off" },
  EMAIL_TO_FUNDRAISE: { secret: false, requiredIn: "never", purpose: "RBB's approved inbox for the Fundraise form; unset = form off" },
  EMAIL_ACK_FORMS: { secret: false, requiredIn: "never", purpose: "comma list of forms that email the submitter an acknowledgement (default none)" },
  EMAIL_TEST_RECIPIENT: { secret: false, requiredIn: "never", purpose: "staging only: the one inbox every form email goes to" },
  FORMS_RATE_LIMIT_MAX: { secret: false, requiredIn: "never", purpose: "submissions per client and form per window (default 5)" },
  FORMS_RATE_LIMIT_WINDOW_S: { secret: false, requiredIn: "never", purpose: "the rate-limit window in seconds (default 600)" },
} as const;

/* The R2 variables that must be set together. R2_S3_API is derivable. */
const R2_REQUIRED = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL"] as const;

export type EnvName = keyof typeof ENV_VARIABLES;
export type AppEnv = "development" | "test" | "production";

export interface Config {
  env: AppEnv;
  orgId: string;
  /* null: no database configured (allowed outside production only). */
  mongo: { uri: string; dbName: string } | null;
  /* `web`: the public site's origin — the only origin its forms accept. */
  cors: { origins: string[]; web: string | null };
  logLevel: "debug" | "info" | "warn" | "error";
  auth: AuthConfig;
  /* Server-side integration credentials. Never sent to a client. */
  integrations: { givebutter: { apiKey: string } | null };
  /* Media object storage; null = not configured. */
  storage: StorageConfig | null;
  /* Where to announce a publish (a build hook); null = nowhere. */
  deployHookUrl: string | null;
  /* M15: the secret the scheduler route requires; null = scheduler off. */
  scheduler: { secret: string } | null;
  /* M18: the public forms — email mode, recipients, limits. */
  forms: FormsConfig;
}

export interface StorageConfig {
  provider: "r2";
  /* PRIVATE S3 endpoint origin — the API signs requests to it. */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /* PUBLIC origin objects are read from (no trailing slash). */
  publicBaseUrl: string;
}

export interface AuthConfig {
  /* Keys the HMACs that pseudonymise IP addresses and throttle keys. */
  secret: string;
  /* True when no AUTH_SECRET was set and a per-process one was generated
     (development and test only). */
  secretIsEphemeral: boolean;
  cookie: { name: string; sameSite: "Strict" | "Lax" | "None"; secure: boolean };
  sessionTtlMs: number;
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
    AUTH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
    AUTH_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be letters, digits, '-' or '_' (max 64)")
      .default("cms_session"),
    AUTH_COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    GIVEBUTTER_API_KEY: z
      .string()
      .regex(/^[A-Za-z0-9|_.-]{20,512}$/, "must be the API key exactly as Givebutter issued it (no spaces or quotes)")
      .optional(),
    R2_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/, "must be the 32-character Cloudflare account id").optional(),
    R2_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "must be an R2 bucket name").optional(),
    R2_ACCESS_KEY_ID: z.string().regex(/^[A-Za-z0-9]{16,128}$/, "must be the access key id exactly as issued").optional(),
    R2_SECRET_ACCESS_KEY: z.string().regex(/^[A-Za-z0-9]{32,128}$/, "must be the secret access key exactly as issued").optional(),
    R2_PUBLIC_URL: z
      .url({ protocol: /^https$/, hostname: z.regexes.domain })
      .refine((value) => !/\.r2\.cloudflarestorage\.com$/i.test(new URL(value).hostname), "must be the PUBLIC bucket URL, not the private S3 endpoint")
      .refine((value) => { const u = new URL(value); return !u.search && !u.hash && !u.username; }, "must be an origin, optionally with a path — no query, fragment or credentials")
      .optional(),
    R2_S3_API: z
      .url({ protocol: /^https$/ })
      .refine((value) => /\.r2\.cloudflarestorage\.com$/i.test(new URL(value).hostname), "must be an https://….r2.cloudflarestorage.com endpoint")
      .optional(),
    DEPLOY_HOOK_URL: z.url({ protocol: /^https$/ }).optional(),
    CRON_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/, "must be at least 32 letters, digits, '-' or '_'").optional(),
    /* M18: the forms' variables are validated by modules/forms/config.ts,
       which fails CLOSED (the form, or every form, off) instead of stopping
       the whole API — here they are only carried through. */
    EMAIL_MODE: z.string().optional(),
    EMAIL_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    EMAIL_TO_CONTACT: z.string().optional(),
    EMAIL_TO_VOLUNTEER: z.string().optional(),
    EMAIL_TO_PARTNER: z.string().optional(),
    EMAIL_TO_FUNDRAISE: z.string().optional(),
    EMAIL_ACK_FORMS: z.string().optional(),
    EMAIL_TEST_RECIPIENT: z.string().optional(),
    FORMS_RATE_LIMIT_MAX: z.string().optional(),
    FORMS_RATE_LIMIT_WINDOW_S: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const need = (name: EnvName, message: string) => ctx.addIssue({ code: "custom", path: [name], message });
    if (env.MONGODB_URI && !env.MONGODB_DB) need("MONGODB_DB", "is required when MONGODB_URI is set");
    if (env.MONGODB_DB && !env.MONGODB_URI) need("MONGODB_URI", "is required when MONGODB_DB is set");
    const r2Set = R2_REQUIRED.filter((name) => env[name]);
    if (r2Set.length > 0 && r2Set.length < R2_REQUIRED.length)
      for (const name of R2_REQUIRED) if (!env[name]) need(name, "is required when any R2_* media storage variable is set");
    if (env.NODE_ENV !== "production") return;
    for (const name of Object.keys(ENV_VARIABLES) as EnvName[])
      if (ENV_VARIABLES[name].requiredIn === "production" && !env[name]) need(name, "is required in production");
    for (const name of ["WEB_ORIGIN", "ADMIN_ORIGIN"] as const)
      if (env[name] && !env[name].startsWith("https://")) need(name, "must be an https:// origin in production");
  })
  /* SameSite=None cookies must be Secure, and cookies are Secure only in
     production (https). */
  .superRefine((env, ctx) => {
    if (env.AUTH_COOKIE_SAMESITE === "none" && env.NODE_ENV !== "production")
      ctx.addIssue({ code: "custom", path: ["AUTH_COOKIE_SAMESITE"], message: "none is only allowed in production (it requires a Secure cookie)" });
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
    cors: { origins: [env.WEB_ORIGIN, env.ADMIN_ORIGIN].filter((o): o is string => Boolean(o)), web: env.WEB_ORIGIN ?? null },
    logLevel: env.LOG_LEVEL,
    auth: {
      secret: env.AUTH_SECRET ?? randomBytes(32).toString("base64url"),
      secretIsEphemeral: !env.AUTH_SECRET,
      cookie: {
        name: env.AUTH_COOKIE_NAME,
        sameSite: ({ strict: "Strict", lax: "Lax", none: "None" } as const)[env.AUTH_COOKIE_SAMESITE],
        /* Secure in production (https). Locally the API is plain http, where
           browsers drop Secure cookies. */
        secure: env.NODE_ENV === "production",
      },
      sessionTtlMs: env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000,
    },
    integrations: {
      givebutter: env.GIVEBUTTER_API_KEY ? { apiKey: env.GIVEBUTTER_API_KEY } : null,
    },
    storage:
      env.R2_ACCOUNT_ID && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_PUBLIC_URL
        ? {
            provider: "r2",
            /* Only the origin: an endpoint written with the bucket in its
               path (as the Cloudflare dashboard shows it) is the same one. */
            endpoint: new URL(env.R2_S3_API ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).origin,
            bucket: env.R2_BUCKET,
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            publicBaseUrl: env.R2_PUBLIC_URL.replace(/\/+$/, ""),
          }
        : null,
    deployHookUrl: env.DEPLOY_HOOK_URL ?? null,
    scheduler: env.CRON_SECRET ? { secret: env.CRON_SECRET } : null,
    forms: loadFormsConfig(pick(source)),
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
