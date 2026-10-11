/* Milestone 3: a record's sharing metadata (SeoOverrides in
   @rbb/content-schema) as the editors change it. `seo` is ONE field of the
   record: the editor always sends all of it, so what is not in it is not
   set. Empty text and an unchosen image are left out; `noIndex` is kept
   only when true — "not hidden" is its absence, never `false` — and a
   record with nothing set has no `seo` at all. */
export interface SeoDraft {
  title?: string;
  description?: string;
  ogImageId?: string;
  noIndex?: boolean;
}

export function nextSeo<S extends SeoDraft>(current: S | undefined, changes: Partial<S>): S | undefined {
  const next = Object.fromEntries(Object.entries({ ...current, ...changes }).filter(([key, v]) => v !== undefined && v !== "" && !(key === "noIndex" && v !== true)));
  return Object.keys(next).length ? (next as unknown as S) : undefined;
}
