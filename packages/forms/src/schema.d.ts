/* Types for ./schema.js — for the TypeScript API (M18). The JavaScript is
   the source of truth; keep these in step with it. */
export type FormId = "contact" | "volunteer" | "partner" | "travel" | "fundraise" | "newsletter";
export type FieldName = "name" | "email" | "organization" | "phone" | "topic" | "message" | "consent" | "marketing";
export interface FieldRule {
  type: "text" | "email" | "select" | "textarea" | "checkbox";
  required: boolean;
  maxLength?: number;
  singleLine?: boolean;
  options?: readonly string[];
}
export declare const TOPICS: readonly string[];
export declare const FIELD_RULES: Record<FieldName, FieldRule>;
export declare const FORM_SCHEMA: Record<FormId, readonly FieldName[]>;
export declare const EMAIL_PATTERN: RegExp;
export declare const HONEYPOT_FIELD: "website";
export declare const MIN_FILL_MS: number;
export declare const MAX_BODY_BYTES: number;
