/* npm run export:settings — the website's CURRENT site settings as one
   content-contract record (src/contract/importers.js siteSettingsRecord),
   written to build-meta/site-settings.json for the API's one-time import:

     pnpm --filter @rbb/web run export:settings
     pnpm api:settings:import -- --file apps/web/build-meta/site-settings.json

   The package.json script first builds the app for Node into
   build-meta/.export/ with the published snapshot switched off
   (RBB_SNAPSHOT=off), so this always exports what the SOURCE content says.
   Public configuration only — the contract admits nothing else. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "build-meta/.export");
try {
  const ssr = await import(pathToFileURL(join(out, "entry-server.js")).href);
  const record = ssr.siteSettingsRecord();
  await mkdir(join(root, "build-meta"), { recursive: true });
  await writeFile(join(root, "build-meta/site-settings.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`Exported the site settings (${Object.keys(record).length} fields) to build-meta/site-settings.json`);
} finally {
  await rm(out, { recursive: true, force: true });
}
