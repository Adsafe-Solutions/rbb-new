/* Team and account rules as the admin applies them (M17.3) — pure, so they
   are unit-tested (scripts/test/users.test.mjs). The API enforces all of
   them; these must never offer something it would refuse. No imports with
   side effects: this module also runs under plain Node. */

/* The API's password policy (apps/api/src/modules/auth/password.ts). */
export const PASSWORD_RULES = { minLength: 12, maxLength: 256 } as const;
export const PASSWORD_HELP = `At least ${PASSWORD_RULES.minLength} characters. A passphrase of a few unrelated words is easy to remember and hard to guess.`;

/* A setup link's token, exactly as the API issues it. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/* The link an owner hands over. The token is in the FRAGMENT: browsers
   never send it to a server, so it stays out of request logs, and a
   referrer never carries it. */
export const setupLinkFor = (origin: string, token: string) => `${origin.replace(/\/+$/, "")}/setup-password#token=${token}`;

/* The token from a location hash ("#token=…"), or null for anything else. */
export function readSetupToken(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const token = new URLSearchParams(hash.slice(1)).get("token");
  return token && TOKEN.test(token) ? token : null;
}

export type MemberAction = "role" | "setupLink" | "revokeSessions" | "deactivate" | "reactivate";

/* What an owner may do to a member from the team list. Never to yourself:
   your own password and sessions are on your Account page, and your own
   role and status are not yours to change (the API refuses it too). */
export function actionsFor(member: { isYou: boolean; status: "active" | "disabled"; passwordSet: boolean; activeSessions: number }): MemberAction[] {
  if (member.isYou) return [];
  if (member.status === "disabled") return ["reactivate"];
  return ["role", ...(member.passwordSet ? [] : (["setupLink"] as const)), ...(member.activeSessions > 0 ? (["revokeSessions"] as const) : []), "deactivate"];
}

export const roleLabel = (role: string) => (role === "OWNER" ? "Owner" : role === "EDITOR" ? "Editor" : role);
export const ROLE_HELP: Record<"OWNER" | "EDITOR", string> = {
  OWNER: "Everything: content, approving and publishing, settings, and the team.",
  EDITOR: "Content and media. Submits work for review; cannot approve, publish, change settings or manage the team.",
};

export type Problems = Record<string, string>;

/* A new password and its confirmation, checked as the API will (length),
   plus what only the form can check (the two match, it differs from the
   current one). Empty object: fine. */
export function newPasswordProblems(password: string, confirm: string, current?: string): Problems {
  const problems: Problems = {};
  if (password.length < PASSWORD_RULES.minLength) problems.password = `Use at least ${PASSWORD_RULES.minLength} characters.`;
  else if (password.length > PASSWORD_RULES.maxLength) problems.password = `Use at most ${PASSWORD_RULES.maxLength} characters.`;
  else if (current !== undefined && password === current) problems.password = "Choose a password different from your current one.";
  if (confirm !== password) problems.confirm = "The two passwords do not match.";
  return problems;
}

/* The add-member form, checked before it is sent. */
export function memberProblems(input: { email: string; name: string }): Problems {
  const problems: Problems = {};
  if (!input.name.trim()) problems.name = "Enter their name.";
  else if (input.name.trim().length > 120) problems.name = "Use at most 120 characters.";
  const email = input.email.trim();
  if (!email) problems.email = "Enter their email address.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.email = "Enter a valid email address.";
  return problems;
}

/* The API's error shape (ApiRequestError), structurally — this module does
   not import the client. */
export interface ApiErrorLike {
  status: number;
  code?: string;
  message: string;
  retryAfterSeconds?: number | null;
  details?: { path: string; message: string }[];
}

const isApiError = (error: unknown): error is ApiErrorLike => typeof error === "object" && error !== null && typeof (error as ApiErrorLike).status === "number";

export const waitText = (seconds: number | null | undefined) => {
  const minutes = Math.max(1, Math.ceil((seconds ?? 60) / 60));
  return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
};

/* A sentence for an error from the API. Its own messages for 400/403/404/409
   are written for people; throttling, outages and network failures get
   ours. */
export function messageFor(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!isApiError(error)) return fallback;
  if (error.status === 429) return `Too many attempts. Try again in ${waitText(error.retryAfterSeconds)}.`;
  if (error.status === 0 || error.status >= 500) return "The server could not be reached. Try again shortly.";
  if (error.status === 401) return "Your session has ended. Sign in again.";
  return error.message || fallback;
}

/* Field-level problems from a VALIDATION_ERROR ("body.email" → "email",
   "currentPassword" → "currentPassword"). */
export function fieldProblems(error: unknown): Problems {
  if (!isApiError(error) || !error.details?.length) return {};
  const problems: Problems = {};
  for (const { path, message } of error.details) {
    const field = path.replace(/^body\./, "");
    // The API's rule phrases ("is incorrect", "must be at least …") read as "It …"; anything else stands alone.
    const sentence = /^(is|must) /.test(message) ? `${field === "currentPassword" ? "This" : "It"} ${message}` : message.charAt(0).toUpperCase() + message.slice(1);
    problems[field] ??= sentence.endsWith(".") ? sentence : `${sentence}.`;
  }
  return problems;
}
