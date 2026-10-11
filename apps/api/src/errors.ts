import type { z } from "zod";

/* The API's one error type. Every failure a client sees is an ApiError
   with a stable `code`; anything else that escapes a handler becomes
   INTERNAL_ERROR with a generic message — its details go to the log,
   never into the response. */

export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  /* M18: a public form's fields failed validation — details carry
     `fields.<name>` and a short code, never what was typed. */
  UNPROCESSABLE_CONTENT: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/* A field-level problem: where, and what is wrong — never the value. */
export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;
  readonly headers: Record<string, string> | undefined;

  constructor(code: ErrorCode, message: string, options: { details?: ErrorDetail[]; headers?: Record<string, string>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export const errors = {
  badRequest: (message = "The request is malformed.") => new ApiError("BAD_REQUEST", message),
  validation: (details: ErrorDetail[], message = "Request validation failed.") => new ApiError("VALIDATION_ERROR", message, { details }),
  unauthenticated: (message = "Authentication is required.") => new ApiError("UNAUTHENTICATED", message),
  forbidden: (message = "This request is not allowed.") => new ApiError("FORBIDDEN", message),
  notFound: (what = "resource") => new ApiError("NOT_FOUND", `The requested ${what} was not found.`),
  methodNotAllowed: (allowed: string[]) =>
    new ApiError("METHOD_NOT_ALLOWED", "This method is not allowed here.", { headers: { Allow: allowed.join(", ") } }),
  conflict: (message: string) => new ApiError("CONFLICT", message),
  unprocessable: (details: ErrorDetail[], message = "Some fields need attention.") => new ApiError("UNPROCESSABLE_CONTENT", message, { details }),
  payloadTooLarge: (limit: number) => new ApiError("PAYLOAD_TOO_LARGE", `The request body is larger than ${limit} bytes.`),
  unsupportedMediaType: () => new ApiError("UNSUPPORTED_MEDIA_TYPE", "The request body must be application/json."),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiError("RATE_LIMITED", "Too many requests.", { headers: { "Retry-After": String(retryAfterSeconds) } }),
  internal: (cause?: unknown) => new ApiError("INTERNAL_ERROR", "Something went wrong.", { cause }),
  unavailable: (message = "The service is temporarily unavailable.", cause?: unknown) =>
    new ApiError("SERVICE_UNAVAILABLE", message, { cause }),
};

/* A Zod failure on request input → VALIDATION_ERROR, paths prefixed with
   where the input came from ("params.slug", "body.title"). Zod's messages
   describe the rule, not the input. */
export const fromZod = (error: z.ZodError, source: "params" | "query" | "body") =>
  errors.validation(error.issues.map((issue) => ({ path: [source, ...issue.path].join("."), message: issue.message })));
