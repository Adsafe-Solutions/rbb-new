import { idFrom } from "../blocks/ids.ts";

/* Career roles' ids (2026-10-13): the address of a role's application
   form (Admin → Forms, `career-<id>`). A role keeps the id it was saved
   with — renaming it does not move its form; a role without one gets one
   from its title, unique among the page's roles. Plain function,
   unit-tested (scripts/test). */
export function withRoleIds<R extends { id?: string; title: string }>(roles: readonly R[]): R[] {
  const out: R[] = [];
  for (const role of roles) {
    const taken = [...out, ...roles.filter((r) => r !== role)].filter((r): r is R & { id: string } => Boolean(r.id));
    out.push(role.id ? role : { ...role, id: idFrom(role.title, taken, "role") });
  }
  return out;
}
