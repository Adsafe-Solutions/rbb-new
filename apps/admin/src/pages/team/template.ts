/* A team TEMPLATE: a member carrying a release marker — a role, not a
   person (apps/api modules/content/workflow.ts). Edited like a draft,
   never submitted, approved, scheduled or published; an owner's "Unmark
   template" makes it a real member's draft. */
export const isTemplate = (record: { releaseMarker?: unknown } | null | undefined): boolean => typeof record?.releaseMarker === "string" && record.releaseMarker.trim() !== "";
