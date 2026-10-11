/* The Highlights editor's pure rules (M23), unit-tested under plain Node
   (scripts/test/highlights.test.mjs). The API enforces every one of them;
   these keep the editor from offering what it would refuse. */

/* The website's own limit: four circles. */
export const STRIP_LIMIT = 4;

export interface AppealOption {
  id: string;
  title: string;
  status: string;
  live: boolean;
  /* The appeal's own circle settings (Appeal.highlight), if any. */
  circleLabel?: string;
}

/* One row of the editor: the appeal chosen for that circle ("" = none yet). */
export interface CircleDraft {
  appealId: string;
}

export const draftOf = (appealIds: string[] | undefined): CircleDraft[] => (appealIds ?? []).map((appealId) => ({ appealId }));
export const payloadOf = (rows: CircleDraft[]): string[] => rows.map((r) => r.appealId);

/* Problems before saving, keyed by the API's paths. */
export function stripProblems(rows: CircleDraft[], options: AppealOption[]): Map<string, string> {
  const problems = new Map<string, string>();
  const known = new Set(options.map((o) => o.id));
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.appealId) problems.set(`appealIds.${i}`, "Choose an appeal for this circle, or remove it.");
    else if (seen.has(r.appealId)) problems.set(`appealIds.${i}`, "This appeal is already in another circle.");
    else if (!known.has(r.appealId)) problems.set(`appealIds.${i}`, "This appeal is archived or no longer exists. Choose another, or remove it.");
    seen.add(r.appealId);
  });
  if (rows.length > STRIP_LIMIT) problems.set("appealIds", `At most ${STRIP_LIMIT} circles.`);
  return problems;
}

/* What a circle shows: the appeal's own short label, else its title. */
export const circleLabel = (o: AppealOption | undefined) => o?.circleLabel || o?.title || "";

/* Chosen appeals that cannot go live until they are approved. */
export const notReady = (rows: CircleDraft[], options: AppealOption[]) =>
  rows.map((r) => options.find((o) => o.id === r.appealId)).filter((o): o is AppealOption => Boolean(o) && !(o!.status === "approved" || o!.status === "published" || o!.live));
