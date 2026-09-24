/* The publishing filter — Document 18. A Vite plugin that removes every
   record that is not APPROVED from the content collections below, at build
   time, before bundling. What it removes never reaches the JavaScript
   bundle, the pre-rendered HTML, the sitemap or structured data — not
   hidden, not filtered at runtime: absent.

   The dev server does NOT run it (`apply: "build"`), so records being
   prepared stay in the content files where the developer/editor can
   validate them (`npm run validate:content`) before RBB approves them.
   Runtime filters (`published()`, `approvedMembers()`, `PROJECTS`, …)
   keep them off every page there too; this plugin is the guarantee that
   production cannot ship them even if a filter were missed.

   Only listed collections are touched. Figures such as the impact metrics
   carry their own verification status and are rendered with it
   (Documents 02, 05, 09) — they are NOT publishing records and are left
   alone.

   Counts of what was kept and removed are written to
   build-meta/content-excluded.json — counts only, never content. Set
   RBB_KEEP_DRAFTS=1 to skip the filter (the content validator's own
   throwaway build does this; nothing built that way is ever published). */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/* file → { collection name → the field holding its publishing status } */
export const COLLECTIONS = {
  "src/content/stories.js": { STORIES: "status" },
  "src/content/work.js": { PROJECT_RECORDS: "editorialStatus" },
  "src/content/team.js": { TEAM_MEMBERS: "status" },
  "src/content/donation.js": { givingMethods: "status", faqs: "status" },
};

const PUBLISHABLE = "approved";

/* The collection's array literal, whether it is `const NAME = [...]` or a
   property `name: [...]` inside an exported object. */
function findArrays(ast, names) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (
      node.type === "VariableDeclarator" &&
      node.id?.type === "Identifier" &&
      names.has(node.id.name) &&
      node.init?.type === "ArrayExpression"
    ) {
      found.push({ name: node.id.name, array: node.init });
    }
    if (
      node.type === "Property" &&
      !node.computed &&
      names.has(node.key?.name ?? node.key?.value) &&
      node.value?.type === "ArrayExpression"
    ) {
      found.push({ name: node.key.name ?? node.key.value, array: node.value });
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  };
  walk(ast);
  return found;
}

/* The literal value of `field` on an object-literal record, or null. */
function statusOf(element, field) {
  if (element?.type !== "ObjectExpression") return null;
  const prop = element.properties.find(
    (p) => p.type === "Property" && (p.key?.name ?? p.key?.value) === field
  );
  return prop?.value?.type === "Literal" ? prop.value.value : null;
}

export default function contentPublishing({ root }) {
  const counts = {};
  const keepDrafts = process.env.RBB_KEEP_DRAFTS === "1";
  let isSsr = false;

  return {
    name: "rbb-content-publishing",
    apply: "build",
    enforce: "pre",
    configResolved(config) {
      isSsr = Boolean(config.build.ssr);
    },
    transform(code, id) {
      if (keepDrafts) return null;
      const file = Object.keys(COLLECTIONS).find((f) => id.split("?")[0].endsWith(f));
      if (!file) return null;

      const fields = COLLECTIONS[file];
      const ast = this.parse(code);
      const edits = [];
      for (const { name, array } of findArrays(ast, new Set(Object.keys(fields)))) {
        const field = fields[name];
        const elements = array.elements.filter(Boolean);
        /* A record that is not a plain object literal cannot be checked
           here, so it cannot be published: stop the build. */
        const opaque = elements.find((el) => el.type !== "ObjectExpression");
        if (opaque)
          this.error(
            `${file}: every record in ${name} must be an object literal (found ${opaque.type}).`
          );
        const kept = elements.filter((el) => statusOf(el, field) === PUBLISHABLE);
        counts[`${file.split("/").pop()}:${name}`] = {
          kept: kept.length,
          removed: elements.length - kept.length,
        };
        if (kept.length !== elements.length) {
          edits.push({
            start: array.start,
            end: array.end,
            text: `[${kept.map((el) => code.slice(el.start, el.end)).join(", ")}]`,
          });
        }
      }
      if (!edits.length) return null;
      let out = code;
      for (const e of edits.sort((a, b) => b.start - a.start))
        out = out.slice(0, e.start) + e.text + out.slice(e.end);
      return { code: out, map: null };
    },
    async closeBundle() {
      if (isSsr || keepDrafts) return;
      await mkdir(join(root, "build-meta"), { recursive: true });
      await writeFile(
        join(root, "build-meta/content-excluded.json"),
        JSON.stringify(counts, null, 2) + "\n"
      );
    },
  };
}
