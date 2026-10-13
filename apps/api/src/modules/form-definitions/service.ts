import { z } from "zod";
import { BUILT_IN_FORM_IDS, DEFAULT_FORMS, FormDefinition, newCareerForm, type Careers, type FormDefinitionData } from "@rbb/content-schema";
import { errors, fromZod } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { requirePermission } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";
import type { FormDefinitionStore } from "./repository.ts";

/* The website forms in the admin — OWNERS only (forms:write), live WHEN
   SAVED (owner decision, 2026-10-13): saving stores the form and
   publishes a website version with only the forms changed
   (PublishService.publishForms).

     Contact Us, Volunteer, Partner With Us   always listed; the built-in
                                              form until first saved, and
                                              "reset" returns to it
     career-<role>                            one application form per open
                                              role on the Careers page

   Audit: by form id and field count only. */

const isBuiltIn = (id: string): id is (typeof BUILT_IN_FORM_IDS)[number] => (BUILT_IN_FORM_IDS as readonly string[]).includes(id);
const CAREER = /^career-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/* What the editor sends: the form's words and fields. Identity (id, kind,
   role, organization) is the API's. */
const SaveBody = z.strictObject({
  title: z.unknown(),
  heading: z.unknown(),
  intro: z.unknown().optional(),
  submitLabel: z.unknown(),
  successMessage: z.unknown(),
  errorMessage: z.unknown(),
  fields: z.unknown(),
});

export interface FormListItem {
  definition: FormDefinitionData;
  /* Saved in the admin (false: the website's built-in form). */
  saved: boolean;
  updatedAt: string | null;
}

export interface Publisher {
  publishForms(auth: AuthContext, facts: RequestFacts): Promise<{ version: number } | null>;
}

export class FormDefinitionService {
  readonly #store: FormDefinitionStore;
  readonly #careers: { get(): Promise<{ record: Careers } | null> } | null;
  readonly #publisher: Publisher | null;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #now: () => Date;

  constructor(store: FormDefinitionStore, deps: { careers?: { get(): Promise<{ record: Careers } | null> } | null; publisher?: Publisher | null; audit: AuditService; orgId: string; now?: () => Date }) {
    this.#store = store;
    this.#careers = deps.careers ?? null;
    this.#publisher = deps.publisher ?? null;
    this.#audit = deps.audit;
    this.#orgId = deps.orgId;
    this.#now = deps.now ?? (() => new Date());
  }

  /* The Careers page's roles (the saved working copy) that have an id. */
  async #roles(): Promise<{ id: string; title: string }[]> {
    const careers = await this.#careers?.get();
    return (careers?.record.opportunities.roles ?? []).filter((r): r is { id: string; title: string } => Boolean(r.id)).map((r) => ({ id: r.id, title: r.title }));
  }

  async list(auth: AuthContext | null): Promise<{ forms: FormListItem[]; roles: { id: string; title: string; formId: string; hasForm: boolean }[] }> {
    requirePermission(auth, "forms:write");
    const [stored, roles] = await Promise.all([this.#store.list(), this.#roles()]);
    const byId = new Map(stored.map((d) => [d.id, d]));
    const item = (d: FormDefinition): FormListItem => ({ definition: strip(d), saved: true, updatedAt: d.updatedAt ?? null });
    const forms: FormListItem[] = [
      ...BUILT_IN_FORM_IDS.map((id) => (byId.has(id) ? item(byId.get(id)!) : { definition: DEFAULT_FORMS[id], saved: false, updatedAt: null })),
      ...stored.filter((d) => d.kind === "career").map(item),
    ];
    return { forms, roles: roles.map((r) => ({ ...r, formId: `career-${r.id}`, hasForm: byId.has(`career-${r.id}`) })) };
  }

  /* One form as the editor starts from: saved, built-in, or — for a role
     without one yet — a new application form. */
  async get(auth: AuthContext | null, id: string): Promise<FormListItem> {
    requirePermission(auth, "forms:write");
    const stored = await this.#store.get(id);
    if (stored) return { definition: strip(stored), saved: true, updatedAt: stored.updatedAt ?? null };
    if (isBuiltIn(id)) return { definition: DEFAULT_FORMS[id], saved: false, updatedAt: null };
    const role = CAREER.exec(id)?.[1];
    const found = role ? (await this.#roles()).find((r) => r.id === role) : undefined;
    if (!found) throw errors.notFound("form");
    return { definition: newCareerForm(found.id, found.title), saved: false, updatedAt: null };
  }

  async save(auth: AuthContext | null, id: string, body: unknown, facts: RequestFacts): Promise<{ form: FormListItem; publishedVersion: number | null }> {
    const member = requirePermission(auth, "forms:write");
    const input = SaveBody.safeParse(body);
    if (!input.success) throw fromZod(input.error, "body");
    let kind: FormDefinition["kind"];
    let roleId: string | undefined;
    if (isBuiltIn(id)) kind = id;
    else {
      roleId = CAREER.exec(id)?.[1];
      if (!roleId || !(await this.#roles()).some((r) => r.id === roleId)) throw errors.validation([{ path: "params.id", message: "is not an open role on the Careers page (save the Careers page with this role first)" }]);
      kind = "career";
    }
    const parsed = FormDefinition.safeParse({ ...input.data, id, orgId: this.#orgId, kind, ...(roleId && { roleId }), updatedAt: this.#now().toISOString() });
    if (!parsed.success) throw fromZod(parsed.error, "body");
    const before = await this.#store.get(id);
    await this.#store.save(parsed.data);
    await this.#audit.recordSafely({ action: before ? "forms.updated" : "forms.created", resourceType: "form", resourceId: id, actorUserId: member.user.id, metadata: { fields: parsed.data.fields.length } }, facts);
    const published = await this.#publisher?.publishForms(member, facts);
    return { form: { definition: strip(parsed.data), saved: true, updatedAt: parsed.data.updatedAt ?? null }, publishedVersion: published?.version ?? null };
  }

  /* A career form: deleted (its role shows no Apply button). A built-in
     form: reset — the website's built-in form again. Live at once. */
  async remove(auth: AuthContext | null, id: string, facts: RequestFacts): Promise<{ removed: boolean; publishedVersion: number | null }> {
    const member = requirePermission(auth, "forms:write");
    const removed = await this.#store.remove(id);
    if (!removed) throw errors.notFound("form");
    await this.#audit.recordSafely({ action: isBuiltIn(id) ? "forms.reset" : "forms.deleted", resourceType: "form", resourceId: id, actorUserId: member.user.id, metadata: {} }, facts);
    const published = await this.#publisher?.publishForms(member, facts);
    return { removed, publishedVersion: published?.version ?? null };
  }

  /* The form a submission is checked against: saved, else none (the
     built-in schema applies). */
  async live(id: string): Promise<FormDefinition | null> {
    return this.#store.get(id);
  }
}

const strip = ({ orgId: _o, updatedAt: _u, ...rest }: FormDefinition): FormDefinitionData => rest as FormDefinitionData;
