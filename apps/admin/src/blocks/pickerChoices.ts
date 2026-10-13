/* A record picker's chosen ids that are NOT in the list it offers — the
   address of a record the CMS does not have (a page still naming the
   website's own story, say) or one that was deleted or archived since.
   They cannot be unticked, because there is no box to untick: the picker
   lists them separately, each with a Remove button (blocks/fields.tsx
   RecordPicker). Plain functions, unit-tested (scripts/test).

   While the list is still loading (`records` null) nothing is reported:
   an id is only "not in the list" once the list is known. */
export function unlistedChoices(value: readonly string[], records: readonly { id: string }[] | null): string[] {
  if (!records) return [];
  const listed = new Set(records.map((r) => r.id));
  return [...new Set(value.filter((id) => !listed.has(id)))];
}

/* The choice without one id — every other id kept, in its order. */
export const withoutChoice = (value: readonly string[], id: string): string[] => value.filter((chosen) => chosen !== id);
