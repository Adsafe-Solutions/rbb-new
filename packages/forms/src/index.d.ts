/* Types for ./index.js — for the TypeScript API (M18). */
export * from "./schema.js";
import type { FieldName, FormId } from "./schema.js";

/* A field's problem: a short code, never what was typed. */
export type FieldCode = "required" | "format" | "too-long" | "invalid";

export type SubmissionResult =
  | { ok: true; formId: FormId; data: Partial<Record<FieldName, string | boolean>> }
  | { ok: false; status: 400 | 404 | 422; error: string; fields?: Partial<Record<FieldName, FieldCode>> };

export declare const CONTROL: RegExp;
export declare function validateSubmission(body: unknown): SubmissionResult;
