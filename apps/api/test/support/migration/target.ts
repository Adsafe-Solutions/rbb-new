import { targetOf } from "../../../src/config/target.ts";
import { TEST_ORG_IDS } from "../../integration/mongo.ts";

/* The migration writer's ONE target: the reserved test database, as the
   reserved test organization. Positively — by exact name, before
   connecting — and confirmed after connecting, read-only: the database
   exists and holds nothing but reserved test organizations' records.
   There is no option, flag or variable that changes either name. */
export const REHEARSAL_DATABASE = "risingbeyondborders_test";
export const REHEARSAL_ORGANIZATION = "test-org";

export function rehearsalTargetProblems({ database, organization }: { database: string | undefined; organization: string }): string[] {
  const problems: string[] = [];
  const target = targetOf({ database });
  if (target.kind === "production") problems.push("this is the PRODUCTION database — the migration writer never writes there");
  else if (database !== REHEARSAL_DATABASE) problems.push(`the writer writes only to "${REHEARSAL_DATABASE}"; this target is ${database ? `"${database}" (${target.kind})` : "no database"}`);
  if (organization !== REHEARSAL_ORGANIZATION) problems.push(`the writer writes only as the organization "${REHEARSAL_ORGANIZATION}", not "${organization}"`);
  return problems;
}

/* Read-only, after connecting: the database exists and every record in it
   belongs to a reserved test organization (the integration harness's own
   rule — but without its cleanup: nothing is deleted here). */
const LIVE_ORG = /^live-[0-9a-f]+$/;
export async function databaseProblems(db: { listCollections: (f: object, o: object) => { toArray(): Promise<{ name: string }[]> }; collection: (name: string) => { countDocuments(filter: object): Promise<number> } }): Promise<string[]> {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  if (!names.length) return [`"${REHEARSAL_DATABASE}" does not exist on this cluster — refusing rather than guessing`];
  const problems: string[] = [];
  for (const name of names.sort()) {
    const foreign = await db.collection(name).countDocuments({ orgId: { $exists: true, $nin: [...TEST_ORG_IDS], $not: LIVE_ORG } });
    if (foreign) problems.push(`${name} holds ${foreign} record(s) of an organization that is not a reserved test organization — this is not the dedicated test database`);
  }
  return problems;
}
