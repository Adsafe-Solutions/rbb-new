/* Applying a published snapshot's overrides (scripts/snapshot-adapter.mjs
   overridesFrom) to LIVE content objects — the runtime counterpart of the
   build's appendOverrides, with the same meaning for every form:

     NAME            an object gains the values; a collection's contents
                     are replaced
     NAME.a.b        the same, on that object inside the export (M20)
     { $byId: … }    each record with that id gains its values, in place;
                     every id must be found (M19)

   and the same refusals: an export the module no longer declares, a
   nested target that is not the object the snapshot sets, a record id
   that is not there. Plain code, nothing of the browser or the build in
   it (scripts/test/runtime-snapshot.test.mjs checks it against the
   build's own appended assignments); src/lib/runtimeOverrides.js is the
   hook the content modules call with it. */
import { BY_ID } from "../../scripts/snapshot-adapter.mjs";

const ROOT = /^[A-Z_][A-Z0-9_]*$/;
const KEY = /^[A-Za-z_]\w*$/;
/* The build writes the values as JSON; the same here, so a module never
   shares an object with the snapshot it came from. */
const clone = (v) => JSON.parse(JSON.stringify(v));

const problem = (file, name, what) => new Error(`${file}: ${name} ${what} — update scripts/snapshot-adapter.mjs`);

export function applyOverrides(exports, overrides, file) {
  for (const [name, values] of Object.entries(overrides)) {
    const [root, ...rest] = name.split(".");
    if (!ROOT.test(root) || rest.some((key) => !KEY.test(key))) throw new Error(`${file}: "${name}" is not a target the snapshot can set`);
    if (!(root in exports)) throw new Error(`${file} no longer declares "export const ${root}" — update scripts/snapshot-adapter.mjs`);
    const byId = values !== null && typeof values === "object" && !Array.isArray(values) && BY_ID in values;
    let target = exports[root];
    for (const key of rest) target = target === null || typeof target !== "object" ? undefined : target[key];
    if (target === null || typeof target !== "object" || Array.isArray(target) !== (Array.isArray(values) || byId)) throw problem(file, name, "is not the object the snapshot sets");
    if (byId) {
      for (const [id, v] of Object.entries(values[BY_ID])) {
        const record = target.find((r) => r.id === id);
        if (!record) throw problem(file, name, `has no record ${JSON.stringify(id)}`);
        Object.assign(record, clone(v));
      }
    } else if (Array.isArray(values)) target.splice(0, target.length, ...clone(values));
    else Object.assign(target, clone(values));
  }
}
