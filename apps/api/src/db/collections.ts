import type { Db, IndexDescription } from "mongodb";

/* Every collection the API uses, and the indexes each one needs. Indexes
   exist only for a query or a uniqueness rule the code actually has:

   appeals
     orgId_slug_unique   an appeal is looked up by its slug within its
                         organization, and a slug must be unique there (it
                         is the URL)
     orgId_id_unique     an appeal is looked up and updated by its content
                         id, which other records reference — also unique per
                         organization

   Every index starts with orgId, so each organization's records stay
   separate even if a database is ever shared. */
export const COLLECTIONS = {
  appeals: "appeals",
} as const;

export const INDEXES: Record<keyof typeof COLLECTIONS, IndexDescription[]> = {
  appeals: [
    { name: "orgId_slug_unique", key: { orgId: 1, slug: 1 }, unique: true },
    { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
  ],
};

/* Creates any missing index. Idempotent — an index that already exists
   with the same definition is left as it is — and never drops or rewrites
   anything: an existing index with a conflicting definition makes MongoDB
   refuse, and the error is reported instead. */
export async function ensureIndexes(db: Db): Promise<Record<string, string[]>> {
  const created: Record<string, string[]> = {};
  for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
    created[name] = await db.collection(name).createIndexes(INDEXES[key]);
  }
  return created;
}
