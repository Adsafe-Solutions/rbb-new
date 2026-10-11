import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { POLICY_IDS, POLICY_ROUTES, Policy, policyApprovalProblems, type PolicyId } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { ErrorDetail } from "../../errors.ts";
import type { AuditService } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import { member } from "../content/shared.ts";
import type { MediaStore } from "../media/repository.ts";
import type { SettingsStore } from "../settings/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig, type BlockPageView } from "../pages/service.ts";

/* Site policies (M19) — exactly three per organization, each a TYPED
   single page (modules/pages with named parts, as Careers) with a fixed id
   and route (packages/content-schema Policy):

     privacy    /privacy           Privacy Policy
     terms      /terms             Terms of Use
     donation   /donation-policy   Donation Policy

   Lifecycle, revisions, 409 on a stale revision, owner-only approval and
   publishing, scheduling, the publish lock — all the page service's. The
   audit is policy.created/updated/archived with the policy's id as
   resourceId and the changed PART names (`sections`, `effectiveDate`) —
   never the wording.

   ⚠ No legal text is written here. A new policy starts empty — its site
   title and related policies only — and RBB supplies everything else.

   Approving (or publishing) needs both of RBB's dates and at least one
   section (`policyApprovalProblems`). A contact is a method of the
   organization's settings, by id — the settings the next website publish
   freezes into the snapshot with the policy (the snapshot contract checks
   the pair again).

     GET    /api/v1/policies           the three, with their state, and the
                                       contact methods a policy may name
     GET    /api/v1/policies/<id>      one ({ record: null } before it exists)
     POST   /api/v1/policies/<id>      create (once)
     PATCH  /api/v1/policies/<id>      { revision, changes: { title?,
                                         effectiveDate?, lastUpdated?, intro?,
                                         sections?, contactReference?,
                                         relatedPolicies?, seo?, status? } }
                                       revision 0 creates; null clears an
                                       optional part
     DELETE /api/v1/policies/<id>      archive
     POST   /api/v1/policies/<id>/submit | withdraw | approve | reject |
                                 schedule | unschedule */

export const POLICY_CONFLICT = "This policy was changed elsewhere since you opened it. Reload the latest version before saving.";

/* The site's own names and cross-links (apps/web src/content/policies.js)
   — navigation, not policy text. */
export const POLICY_LABELS: Record<PolicyId, string> = { privacy: "Privacy Policy", terms: "Terms of Use", donation: "Donation Policy" };
const RELATED: Record<PolicyId, PolicyId[]> = { privacy: ["terms", "donation"], terms: ["privacy", "donation"], donation: ["privacy", "terms"] };

const PARTS = ["title", "effectiveDate", "lastUpdated", "intro", "sections", "contactReference", "relatedPolicies", "seo"] as const;

export const policyPage = (id: PolicyId, settings: SettingsStore): BlockPageConfig<Policy> => ({
  kind: "policy",
  recordId: id,
  label: POLICY_LABELS[id],
  contract: Policy,
  mediaIds: () => [],
  conflict: POLICY_CONFLICT,
  parts: PARTS,
  initial: () => ({ title: POLICY_LABELS[id], intro: [], sections: [], relatedPolicies: RELATED[id] }),
  check: async (record, at): Promise<ErrorDetail[]> => {
    const problems: ErrorDetail[] = [];
    if (record.status === "approved" || record.status === "published") problems.push(...policyApprovalProblems(record).map((p) => ({ path: `${at}.${p.path}`, message: p.message })));
    if (record.contactReference) {
      const methods = (await settings.get())?.record.contact.methods ?? [];
      if (!methods.some((m) => m.id === record.contactReference)) problems.push({ path: `${at}.contactReference`, message: "must be one of the contact methods in the organization's settings" });
    }
    return problems;
  },
});

export type PolicyStore = BlockPageStore<Policy>;

export class MongoPolicyStore extends MongoBlockPageStore<Policy> {
  constructor(db: Db, orgId: string, id: PolicyId) {
    super(db, COLLECTIONS.policies, orgId, { field: "policyId", value: id });
  }
}

export class PolicyService extends BlockPageService<Policy> {
  constructor(id: PolicyId, store: PolicyStore, settings: SettingsStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(policyPage(id, settings), store, media, audit, options);
  }
}

export interface PolicySummary {
  id: PolicyId;
  route: string;
  label: string;
  view: BlockPageView<Policy>;
}

/* The three policies at once, for the admin's list, and the contact
   methods a policy may name (id, type and label — what the picker shows). */
export class PolicyDirectory {
  readonly #services: Record<PolicyId, PolicyService>;
  readonly #settings: SettingsStore;
  readonly #orgId: string;

  constructor(services: Record<PolicyId, PolicyService>, settings: SettingsStore, orgId: string) {
    this.#services = services;
    this.#settings = settings;
    this.#orgId = orgId;
  }

  async list(auth: AuthContext): Promise<{ policies: PolicySummary[]; contactMethods: { id: string; type: string; label: string; value: string }[] }> {
    member(auth, this.#orgId);
    const policies = await Promise.all(POLICY_IDS.map(async (id) => ({ id, route: POLICY_ROUTES[id], label: POLICY_LABELS[id], view: await this.#services[id].get(auth) })));
    const methods = (await this.#settings.get())?.record.contact.methods ?? [];
    return { policies, contactMethods: methods.map(({ id, type, label, value }) => ({ id, type, label, value })) };
  }
}
