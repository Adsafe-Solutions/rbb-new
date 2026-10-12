/* The runtime snapshot's hook. A build without a runtime snapshot never
   calls this (the plugin bakes assignments instead); a build with one
   appends, to the end of every target module, a call to
   `applyRuntimeOverrides` (scripts/vite-published-snapshot.mjs) — which
   applies whatever snapshot src/lib/runtimeBoot.js chose, BEFORE the
   module's dependents load, so everything derived from the content at
   load time (titles, the footer, the routes) follows, exactly as it
   follows the baked assignments. The applying itself:
   src/lib/snapshotOverrides.js. */
import { applyOverrides } from "./snapshotOverrides.js";
import { snapshotState } from "./runtimeBoot.js";

/* Called at the end of a target module with its exports, by name. Applies
   the chosen snapshot's values for that file; a failure is recorded, not
   thrown — a module must finish loading — and runtimeBoot.js acts on it
   once everything has loaded. */
export function applyRuntimeOverrides(file, exports) {
  const state = snapshotState();
  const values = state?.overrides?.[file];
  if (!values) return false;
  try {
    applyOverrides(exports, values, file);
    state.applied.push(file);
    return true;
  } catch (error) {
    state.failed ??= { file, message: error.message };
    return false;
  }
}
