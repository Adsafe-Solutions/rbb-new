import { readFileSync } from "node:fs";
import { overridesFrom } from "../../snapshot-adapter.mjs";

/* The saved copy of the live snapshot (fixtures/published-snapshot.json) —
   since 2026-10-13 the website keeps no built-in copy of the CMS's
   content, so a test that renders real pages applies this, as a build
   applies the API's. */
export const SAVED_SNAPSHOT = JSON.parse(readFileSync(new URL("../../../fixtures/published-snapshot.json", import.meta.url), "utf8"));

/* Applies `snapshot` to a Vite SSR loader's live content modules with the
   site's own src/lib/snapshotOverrides.js — what the runtime hook does.
   Values a module derives from others WHILE IT LOADS (a title from the
   brand, cards from the programs) are not recomputed: apply before
   loading the modules that derive them, or read them at render time. */
export async function applySnapshot(vite, snapshot = SAVED_SNAPSHOT) {
  const { applyOverrides } = await vite.ssrLoadModule("/src/lib/snapshotOverrides.js");
  for (const [file, values] of Object.entries(overridesFrom(snapshot))) applyOverrides(await vite.ssrLoadModule(`/${file}`), values, file);
}
