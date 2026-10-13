import { errors } from "../../errors.ts";
import { PERMISSIONS, type AuthContext, type Permission, type Role } from "./types.ts";

/* RBAC — the ONE table of who may do what. Routes declare the permission
   they need (`permission` on the route, or `requirePermission` inside a
   handler); nothing checks a role name directly except `requireRole`.

     OWNER    everything — including users and organization settings
     EDITOR   editorial work: read settings, create/update/delete content,
              media and appeals. Never users, settings changes or
              publishing.

   Approval and publishing are OWNER-only (M14): editors prepare content
   and submit it for review (content:update); an owner approves it
   (content:approve) and publishes the website (publish:execute). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  EDITOR: [
    "settings:read",
    "content:read",
    "content:create",
    "content:update",
    "content:delete",
    "media:read",
    "media:write",
    "appeals:read",
    "appeals:write",
  ],
};

export const permissionsFor = (role: Role): readonly Permission[] => ROLE_PERMISSIONS[role] ?? [];

export const can = (auth: Pick<AuthContext, "permissions"> | null, permission: Permission) =>
  Boolean(auth?.permissions.includes(permission));

/* Guards for use inside handlers. The app already enforces a route's own
   `auth` and `permission`; these are for decisions that depend on the
   resource (e.g. "your own session, or users:write"). */
export function requireAuth(auth: AuthContext | null): AuthContext {
  if (!auth) throw errors.unauthenticated();
  return auth;
}

export function requirePermission(auth: AuthContext | null, permission: Permission): AuthContext {
  const context = requireAuth(auth);
  if (!can(context, permission)) throw errors.forbidden("You do not have permission to do this.");
  return context;
}

export function requireRole(auth: AuthContext | null, role: Role): AuthContext {
  const context = requireAuth(auth);
  if (context.membership.role !== role) throw errors.forbidden("You do not have permission to do this.");
  return context;
}
