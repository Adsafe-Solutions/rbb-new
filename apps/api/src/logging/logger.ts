/* Structured logging: one JSON object per line, which Vercel's log drain
   (and any later observability tool) can parse as-is.

   Redaction is applied to everything that is logged, not trusted to the
   caller: keys that name credentials are replaced, and connection strings,
   bearer tokens and API-key-shaped values are masked inside any string —
   including error messages from drivers. Request bodies are never logged
   by the HTTP layer. */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|connection[-_]?string|^uri$|mongodb[-_]?uri/i;

const SENSITIVE_TEXT: [RegExp, string][] = [
  [/mongodb(\+srv)?:\/\/[^\s"'`]+/gi, "[redacted-uri]"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer [redacted]"],
  [/\b(re|sk|pk|rk)_[A-Za-z0-9_]{12,}/g, "[redacted-key]"],
];

export const redactText = (text: string) =>
  SENSITIVE_TEXT.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

function sanitize(value: unknown, includeStacks: boolean, depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name,
      message: redactText(value.message),
      ...(code !== undefined && { code }),
      ...(includeStacks && value.stack && { stack: redactText(value.stack) }),
    };
  }
  if (!value || typeof value !== "object") return value;
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => sanitize(v, includeStacks, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(v, includeStacks, depth + 1)])
  );
}

export function createLogger({
  level = "info",
  base = {},
  write = (line: string) => console.log(line),
  includeStacks = false,
}: { level?: LogLevel; base?: LogFields; write?: (line: string) => void; includeStacks?: boolean } = {}): Logger {
  const emit = (at: LogLevel, message: string, fields: LogFields = {}) => {
    if (RANK[at] < RANK[level]) return;
    const entry = sanitize({ time: new Date().toISOString(), level: at, msg: message, ...base, ...fields }, includeStacks);
    write(JSON.stringify(entry));
  };
  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger({ level, base: { ...base, ...fields }, write, includeStacks }),
  };
}
