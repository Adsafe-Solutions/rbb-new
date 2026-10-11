import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuditService } from "../audit/audit.ts";
import { DEFAULT_SCRYPT, PASSWORD_POLICY, hashPassword, type ScryptParams } from "./password.ts";
import type { AuthStores } from "./repository.ts";
import { normalizeEmail, type Membership, type User } from "./types.ts";

/* Creating the FIRST owner of an organization — the only way an account
   can come into existence in M3 (there is no public registration). Run
   from the command line (src/scripts/bootstrap-owner.ts), never by the
   API itself and never on startup.

   It refuses — and changes nothing — when the organization already has an
   owner, or when the email already has an account. Running it twice is
   therefore safe: the second run stops. */

export const BootstrapInput = z.strictObject({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(120),
  password: z
    .string()
    .min(PASSWORD_POLICY.minLength, `must be at least ${PASSWORD_POLICY.minLength} characters`)
    .max(PASSWORD_POLICY.maxLength),
});

export class BootstrapRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapRefused";
  }
}

export async function bootstrapOwner(
  stores: AuthStores,
  audit: AuditService,
  { orgId, input, now = new Date(), scrypt = DEFAULT_SCRYPT }: { orgId: string; input: unknown; now?: Date; scrypt?: ScryptParams }
): Promise<{ userId: string }> {
  const parsed = BootstrapInput.safeParse(input);
  if (!parsed.success)
    throw new BootstrapRefused(`Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);

  if ((await stores.memberships.countOwners()) > 0) throw new BootstrapRefused("This organization already has an owner. Nothing was changed.");
  const emailNormalized = normalizeEmail(parsed.data.email);
  if (await stores.users.findByEmail(emailNormalized)) throw new BootstrapRefused("An account with this email already exists. Nothing was changed.");

  const at = now.toISOString();
  const user: User = {
    id: randomUUID(),
    orgId,
    email: parsed.data.email.trim(),
    emailNormalized,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password, scrypt),
    status: "active",
    createdAt: at,
    updatedAt: at,
    revision: 1,
  };
  const membership: Membership = {
    id: randomUUID(),
    orgId,
    userId: user.id,
    role: "OWNER",
    status: "active",
    createdAt: at,
    updatedAt: at,
    revision: 1,
  };
  await stores.users.insert(user);
  await stores.memberships.insert(membership);
  await audit.record(
    { action: "auth.owner.bootstrapped", resourceType: "user", resourceId: user.id, metadata: { method: "cli", role: "OWNER" } },
    { requestId: null, clientIp: null, userAgent: null }
  );
  return { userId: user.id };
}
