/* npm run validate:content — Document 18.

   Checks EVERY content record, including drafts and records awaiting
   review, against the rules an approved record must meet
   (src/content/validate.js), so problems surface while content is being
   prepared — before RBB approves it and before a production build would
   stop on it.

   The package.json script first builds the app for Node WITHOUT the
   publishing filter (RBB_KEEP_DRAFTS=1) into build-meta/.validate/. That
   build is only read here and deleted; nothing in it is ever published. */
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "build-meta/.validate");

let failed = false;
try {
  const ssr = await import(pathToFileURL(join(out, "entry-server.js")).href);
  const { errors, warnings, counts } = ssr.validate(true);
  console.log(`Content validation — every record, as if approved`);
  console.log(
    `  records checked: ${Object.entries(counts)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ")} currently approved`
  );
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors) console.log(`  ERROR:   ${e}`);
  console.log(
    errors.length
      ? `\n✗ ${errors.length} problem(s) to fix before these records can be approved.`
      : "\n✓ No problems found."
  );
  failed = errors.length > 0;
} finally {
  await rm(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
