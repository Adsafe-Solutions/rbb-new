import { audienceOf, countsOf, matchesSubmission, submissionOrder, type StoredSubmission, type SubmissionReply, type SubmissionStatus, type SubmissionStore } from "../../src/modules/submissions/repository.ts";

/* The submission store in memory, organization-scoped like MongoDB's. */
export function memorySubmissionStore(rows: StoredSubmission[], orgId: string, options: { failInsert?: boolean } = {}): SubmissionStore {
  const mine = () => rows.filter((r) => r.orgId === orgId);
  return {
    insert: async (s) => {
      if (options.failInsert) throw new Error("database unavailable");
      rows.push(structuredClone({ ...s, orgId }));
    },
    list: async ({ limit, ...q }) => mine().filter((r) => matchesSubmission(r, q)).sort(submissionOrder).slice(0, limit).map((r) => structuredClone(r)),
    get: async (id) => structuredClone(mine().find((r) => r.id === id) ?? null),
    setStatus: async (id: string, status: SubmissionStatus, at: string) => {
      const row = mine().find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, { status, updatedAt: at });
      return structuredClone(row);
    },
    audience: async () => audienceOf(mine()),
    addReply: async (id: string, reply: SubmissionReply) => {
      const row = mine().find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, { replies: [...(row.replies ?? []), structuredClone(reply)], status: "read", updatedAt: reply.at });
      return structuredClone(row);
    },
    remove: async (id) => {
      const i = rows.findIndex((r) => r.orgId === orgId && r.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    },
    counts: async () => {
      const groups = new Map<string, { formId: string; status: SubmissionStatus; n: number }>();
      for (const r of mine()) {
        const key = `${r.formId}:${r.status}`;
        const g = groups.get(key) ?? { formId: r.formId, status: r.status, n: 0 };
        g.n += 1;
        groups.set(key, g);
      }
      return countsOf([...groups.values()]);
    },
  };
}
