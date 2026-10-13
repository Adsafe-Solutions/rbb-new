import { z } from "zod";
import { errors, fromZod } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { requirePermission } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";
import type { AudienceMember, SubmissionStore } from "../submissions/repository.ts";

/* Admin → Audience (2026-10-13) — OWNERS only (submissions:read): every
   unique person who sent any website form, by email address, with the
   forms they used, how often, first and last contact, and their latest
   answer to the marketing emails checkbox. Read from the stored
   submissions (nothing is kept twice): deleting someone's submissions
   removes them here too. Export: CSV, audited (count only). */

const PAGE = 50;
const Query = z.strictObject({
  q: z.string().trim().min(1).max(100).optional(),
  marketing: z.enum(["yes", "no", "unknown"]).optional(),
  form: z.string().regex(/^(contact|volunteer|partner|newsletter|career-[a-z0-9]+(?:-[a-z0-9]+)*)$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export class AudienceService {
  readonly #store: Pick<SubmissionStore, "audience">;
  readonly #audit: AuditService;

  constructor(store: Pick<SubmissionStore, "audience">, audit: AuditService) {
    this.#store = store;
    this.#audit = audit;
  }

  async #filtered(input: unknown) {
    const parsed = Query.safeParse(input ?? {});
    if (!parsed.success) throw fromZod(parsed.error, "query");
    const q = parsed.data;
    const all = await this.#store.audience();
    const needle = q.q?.toLowerCase();
    const items = all.filter(
      (p) =>
        (!needle || p.email.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle)) &&
        (!q.form || p.forms.includes(q.form)) &&
        (!q.marketing || (q.marketing === "yes" ? p.marketing === "Yes" : q.marketing === "no" ? p.marketing === "No" : p.marketing === null))
    );
    return { all, items, page: q.page ?? 1 };
  }

  async list(auth: AuthContext | null, input: unknown): Promise<{ items: AudienceMember[]; total: number; matching: number; optedIn: number; page: number; pages: number }> {
    requirePermission(auth, "submissions:read");
    const { all, items, page } = await this.#filtered(input);
    const pages = Math.max(1, Math.ceil(items.length / PAGE));
    if (page > pages && items.length) throw errors.validation([{ path: "query.page", message: `must be at most ${pages}` }]);
    return { items: items.slice((page - 1) * PAGE, page * PAGE), total: all.length, matching: items.length, optedIn: all.filter((p) => p.marketing === "Yes").length, page, pages };
  }

  /* The audience (as filtered) as CSV — for an owner's mailing tool. */
  async exportCsv(auth: AuthContext | null, input: unknown, facts: RequestFacts): Promise<string> {
    const member = requirePermission(auth, "submissions:read");
    const { items } = await this.#filtered(input);
    await this.#audit.recordSafely({ action: "audience.exported", resourceType: "audience", resourceId: null, actorUserId: member.user.id, metadata: { rows: items.length } }, facts);
    const cell = (v: string | number | null) => {
      const s = v === null ? "" : String(v);
      /* Quoted; a leading =, +, - or @ is neutralised so a spreadsheet never runs it as a formula. */
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const header = ["Email", "Name", "Marketing emails", "Marketing choice made", "Forms", "Submissions", "First contact", "Last contact"];
    const rows = items.map((p) => [p.email, p.name, p.marketing, p.marketingAt, p.forms.join(" "), p.submissions, p.firstAt, p.lastAt].map(cell).join(","));
    return `${header.map(cell).join(",")}\r\n${rows.join("\r\n")}${rows.length ? "\r\n" : ""}`;
  }
}
