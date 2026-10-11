/* M48: the API's field errors for list-valued fields, where its path
   names one item (`context.1`, `relatedPostIds.2`) or its message names
   one record. The editor's error map is keyed by those paths. */

type Errors = ReadonlyMap<string, string>;

/* Errors on single items of `key`, by index: "context.1" → 1. */
export function itemErrors(errors: Errors, key: string): Map<number, string> {
  const items = new Map<number, string>();
  for (const [path, message] of errors) {
    const index = path.startsWith(`${key}.`) ? path.slice(key.length + 1) : null;
    if (index !== null && /^\d+$/.test(index)) items.set(Number(index), message);
  }
  return items;
}

/* One message for a paragraphs field (a single textarea): the field's own
   error, then each paragraph's, numbered as people count them. */
export function paragraphsError(errors: Errors, key: string): string | undefined {
  const parts = [
    ...(errors.has(key) ? [errors.get(key)!] : []),
    ...[...itemErrors(errors, key)].sort(([a], [b]) => a - b).map(([i, message]) => `Paragraph ${i + 1}: ${message}`),
  ];
  return parts.length ? parts.join(" ") : undefined;
}

/* A references field's errors, split between the chosen records and the
   field. An item's own path names it by position; the API's reference
   checks report on the whole field, one message per record, each naming
   it ('refers to story "x", which is archived') — the editor keeps them
   one per line. Anything that names no chosen record stays with the
   field, so a message is never lost. */
export function referenceErrors(errors: Errors, key: string, chosen: readonly string[]): { field: string | undefined; byId: Map<string, string> } {
  const byId = new Map<string, string>();
  const add = (id: string, message: string) => byId.set(id, byId.has(id) ? `${byId.get(id)} ${message}` : message);
  const rest: string[] = [];
  for (const message of errors.get(key)?.split("\n") ?? []) {
    const named = /^refers to \w+ "([^"]+)"/.exec(message)?.[1];
    if (named !== undefined && chosen.includes(named)) add(named, message);
    else rest.push(message);
  }
  for (const [i, message] of [...itemErrors(errors, key)].sort(([a], [b]) => a - b)) {
    if (chosen[i] !== undefined) add(chosen[i]!, message);
    else rest.push(`Item ${i + 1}: ${message}`);
  }
  return { field: rest.length ? rest.join(" ") : undefined, byId };
}
