/* The content contract, for a snapshot fetched at runtime — the SAME
   check the build runs on the snapshot it bakes in (entry-server.jsx
   publishedSnapshotInfo), so nothing reaches a visitor that a build would
   have refused. Loaded on demand: the contract (packages/content-schema,
   zod) is its own chunk, fetched only when the API serves a snapshot
   newer than the build's — never on the ordinary page load. */
export async function snapshotProblems(snapshot) {
  const { PublishedSnapshot } = await import("@rbb/content-schema");
  const result = PublishedSnapshot.safeParse(snapshot);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".") || "(snapshot)"}: ${i.message}`);
}
