import type { AuthContext } from "../../src/modules/auth/types.ts";
import type { RequestFacts } from "../../src/modules/audit/audit.ts";

/* M14 test helpers: the editorial workflow, as an owner would walk it —
   submit for review, then approve (the next website publish takes it).
   For a collection's record (by id) and for a single page. Real
   transitions, never a shortcut. */

type View = { record: { status: string } | null; revision: number };
interface Collection {
  get(auth: AuthContext, id: string): Promise<View>;
  act(auth: AuthContext, id: string, action: "submit" | "approve", input: unknown, facts: RequestFacts): Promise<View>;
}
interface Page {
  get(auth: AuthContext): Promise<View>;
  act(auth: AuthContext, action: "submit" | "approve", input: unknown, facts: RequestFacts): Promise<View>;
}

type ViewOf<S extends { get(...args: never[]): Promise<unknown> }> = Awaited<ReturnType<S["get"]>>;

export async function approve<S extends Collection>(service: S, owner: AuthContext, id: string, facts: RequestFacts): Promise<ViewOf<S>> {
  let v = await service.get(owner, id);
  if (v.record!.status === "draft") v = await service.act(owner, id, "submit", { revision: v.revision }, facts);
  if (v.record!.status === "submitted") v = await service.act(owner, id, "approve", { revision: v.revision }, facts);
  return v as ViewOf<S>;
}

export async function approvePage<S extends Page>(service: S, owner: AuthContext, facts: RequestFacts): Promise<ViewOf<S>> {
  let v = await service.get(owner);
  if (v.record!.status === "draft") v = await service.act(owner, "submit", { revision: v.revision }, facts);
  if (v.record!.status === "submitted") v = await service.act(owner, "approve", { revision: v.revision }, facts);
  return v as ViewOf<S>;
}

/* Create a record, then submit and approve it. */
export async function createApproved<V extends View & { record: { id: string } }>(
  service: Collection & { create(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<V> },
  owner: AuthContext,
  input: Record<string, unknown>,
  facts: RequestFacts
): Promise<V> {
  const created = await service.create(owner, input, facts);
  return (await approve(service, owner, created.record.id, facts)) as unknown as V;
}

/* Save changes, then submit and approve the result. */
export async function updateApproved<V extends View & { record: { id: string } }>(
  service: Collection & { update(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<V> },
  owner: AuthContext,
  id: string,
  input: { revision: number; changes: Record<string, unknown>; confirmSlugChange?: boolean },
  facts: RequestFacts
): Promise<V> {
  if (Object.keys(input.changes).length) await service.update(owner, id, input, facts);
  return (await approve(service, owner, id, facts)) as unknown as V;
}
