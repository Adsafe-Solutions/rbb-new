/* Content migration REHEARSAL — dry run only.

     node apps/web/scripts/migration-rehearsal.mjs [--existing=none|test|production|file:<path>] [--org=<id>] [--out=<manifest.json>]

   Reads the website's source content, converts it as the build's
   conformance check does, and plans the CMS records it would become: what
   would be created, what already exists (matched by organization-scoped
   slug, reported, never changed), what is blocked and what needs a
   decision. Writes nothing anywhere except the manifest file --out names.

   --existing   which records already exist (scripts/migration/existing.mjs):
                none (default: nothing is read), test (the _test database),
                production (read-only, the API's deliberate production
                configuration), or file:<path>.
   --org        the organization, for --existing=test (default test-org).
   --out        write the full manifest there (deterministic JSON);
                without it, only the summary is printed.

   There is no write, apply or publish mode, and none is accepted: any
   such flag — or any flag this command does not know — is refused before
   anything is read. Nothing printed names a host or a credential. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const KNOWN = ["--existing", "--org", "--out"];
const REFUSED = /^--(apply|write|execute|publish|approve|commit|confirm|production|force|upload|seed|create)\b/;

export function parseArgs(argv) {
  const options = { existing: "none" };
  for (const arg of argv) {
    if (REFUSED.test(arg)) throw new Error(`refused: "${arg.split("=")[0]}" — this rehearsal is a dry run only; it never writes, uploads, approves or publishes`);
    const [name, ...rest] = arg.split("=");
    if (!KNOWN.includes(name) || !rest.length) throw new Error(`refused: unknown option "${arg}" (known: ${KNOWN.map((k) => `${k}=…`).join(", ")})`);
    options[name.slice(2)] = rest.join("=");
  }
  return options;
}

function summarize(manifest) {
  const lines = [];
  lines.push(`Migration rehearsal (dry run) for organization "${manifest.organization}"`);
  lines.push(`Existing records: ${manifest.existing.checked ? `${manifest.existing.source}${manifest.existing.database ? `, database "${manifest.existing.database}"` : ""}` : "NOT checked — every create is conditional"}`);
  lines.push(`Source hash: ${manifest.sourceHash.slice(0, 16)}…`);
  lines.push(`Records: ${manifest.summary.records}; media: ${manifest.summary.media}`);
  lines.push(`By action: ${Object.entries(manifest.summary.byAction).map(([a, n]) => `${a} ${n}`).join(", ")}`);
  for (const [type, actions] of Object.entries(manifest.summary.byType)) lines.push(`  ${type.padEnd(18)} ${Object.entries(actions).map(([a, n]) => `${a} ${n}`).join(", ")}`);
  lines.push("Decisions required:");
  for (const d of manifest.decisions) lines.push(`  ${d.id} (${d.count})`);
  lines.push(`In the CMS only (kept; they count toward their collection): ${manifest.cmsOnly.length ? manifest.cmsOnly.map((r) => `${r.type}:${r.slug} (${r.status})`).join(", ") : "none"}`);
  lines.push("Not mapped:");
  for (const n of manifest.notMapped) lines.push(`  ${n.type} (${n.count}): ${n.decision}`);
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  /* Loaded only after the arguments pass. */
  const { loadSource } = await import("./migration/source.mjs");
  const { readExisting, RehearsalRefused } = await import("./migration/existing.mjs");
  const { planMigration } = await import("./migration/plan.mjs");
  const { cmsRules } = await import("./migration/rules.mjs");
  let existing;
  try {
    existing = await readExisting(options.existing, { org: options.org });
  } catch (error) {
    if (!(error instanceof RehearsalRefused)) throw error;
    console.error(`Refused: ${error.message}`);
    return 2;
  }
  const source = await loadSource();
  const manifest = planMigration({ source, existing, rules: cmsRules() });
  console.log(summarize(manifest));
  if (options.out) {
    writeFileSync(resolve(options.out), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Manifest: ${resolve(options.out)}`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
