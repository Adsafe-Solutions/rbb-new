import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, LinkField, ParagraphsField, TextField, clean, sub } from "../../blocks/fields";
import { publishApi, type PublishStatus } from "../../settings/client";
import { careersApi, type Careers, type CareersParts, type CareersView } from "../../careers/client";
import { PublishPanel } from "../settings/PublishPanel";
import styles from "../../content/content.module.css";

/* /careers — the website's Careers page (/about-us/careers): its header,
   "Why work with us", "Open opportunities" with the open roles in order,
   "How to apply", the closing ask and SEO. One per organization: no list,
   just this editor. Until it is PUBLISHED (and an owner publishes the
   site), the website keeps its own Careers page.

   A role is what the page lists: its title — the site has no role pages,
   application forms or application links. Real, open roles only. Saves
   send whole parts with the revision they were based on; a stale one
   offers "Reload latest". */

type Draft = Partial<CareersParts> & { status?: Careers["status"] };
const PARTS = ["kicker", "title", "intro", "why", "opportunities", "apply", "closing", "seo"] as const;
const INITIAL: Draft = {
  title: "",
  intro: "",
  opportunities: { heading: "Open opportunities", empty: "", roles: [] },
  closing: { heading: "", primary: { label: "", href: "" } },
};
const draftOf = (view: CareersView): Draft => (view.record ? structuredClone(view.record) : structuredClone(INITIAL));

export default function CareersPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<CareersView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setProblem(null);
    setErrors(new Map());
    try {
      const v = await careersApi.get();
      setView(v);
      setDraft(draftOf(v));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, []);
  useEffect(() => void load(), [load]);

  const saved = useMemo<Draft>(() => (view ? draftOf(view) : INITIAL), [view]);
  const changed = PARTS.filter((p) => JSON.stringify(draft[p] ?? null) !== JSON.stringify(saved[p] ?? null));
  const dirty = changed.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loadFailed) return <PageContainer width="narrow"><EmptyState title="The Careers page could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading the Careers page" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status);
  const err = (path: string) => errors.get(path);
  const set = (changes: Draft) => setDraft((d) => ({ ...d, ...changes }));
  const opportunities = draft.opportunities ?? INITIAL.opportunities!;
  const setOpportunities = (changes: Partial<Careers["opportunities"]>) => set({ opportunities: { ...opportunities, ...changes } });
  const closing = draft.closing ?? INITIAL.closing!;
  const seo = draft.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Careers["seo"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...seo, ...changes }).filter(([, v]) => v !== undefined && v !== ""));
    set({ seo: Object.keys(next).length ? (next as Careers["seo"]) : undefined });
  };
  const sectionField = (key: "why" | "apply", label: string, defaultHeading: string) => {
    const section = draft[key];
    return (
      <Panel title={label} as="h2" description="Optional. Left out of the page when not included.">
        <div className={styles.fields}>
          <Checkbox label={`Include “${label}”`} checked={Boolean(section)} disabled={readOnly} onChange={(e) => set({ [key]: e.target.checked ? { heading: defaultHeading, body: [""] } : undefined } as Draft)} />
          {section && (
            <>
              <FormField label="Heading" required disabled={readOnly} error={err(`${key}.heading`)}>
                <Input maxLength={160} value={section.heading} onChange={(e) => set({ [key]: { ...section, heading: e.target.value } } as Draft)} />
              </FormField>
              <ParagraphsField label="Paragraphs" value={section.body} onChange={(body) => set({ [key]: { ...section, body } } as Draft)} error={err(`${key}.body`) ?? err(`${key}.body.0`)} disabled={readOnly} />
            </>
          )}
        </div>
      </Panel>
    );
  };

  async function save() {
    if (!view) return;
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const parts = view.record ? changed : PARTS.filter((p) => draft[p] !== undefined);
      const changes = Object.fromEntries(parts.map((p) => [p, draft[p] ?? null]));
      const next = await careersApi.update(view.revision, changes);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: view.record ? "Saved" : "Careers page created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention before this can be saved." : caught.message });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: "The Careers page could not be saved. Try again." });
    } finally {
      setSaving(false);
    }
  }

  /* M15 (owners): queue the approved revision for a website publication,
     or drop that. A 400 is the dialog's to show. */
  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      const next = await careersApi.schedule(view.revision, input);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: "Scheduled", description: "It is published at that time — not before.", tone: "success" });
      publishApi.status().then(setPublish, () => {});
      return null;
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 400) return caught.details.map((d) => d.message).join("; ") || caught.message;
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
      return caught instanceof Error ? caught.message : "It could not be scheduled.";
    } finally {
      setActing(false);
    }
  }

  async function unscheduleIt() {
    if (!view) return;
    setActing(true);
    setProblem(null);
    try {
      const next = await careersApi.unschedule(view.revision);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: "Unscheduled", description: "It stays approved." });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setActing(false);
    }
  }

  /* A workflow transition, on the saved revision (M14). */
  async function act(action: WorkflowAction) {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const next = await careersApi.act(action, view.revision);
      setView(next);
      setDraft(draftOf(next));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention first." : caught.message });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: "The Careers page could not be changed. Try again." });
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      const next = await careersApi.archive();
      setView(next);
      setDraft(draftOf(next));
      toast({ title: "Careers page archived", description: "The website keeps its own Careers page after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "The Careers page could not be archived. Try again." });
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Careers page"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The website's Careers page (/about-us/careers). Until it is published here, the website keeps its own."}
      />
      {publish?.settingsReady && (
        <div className={styles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {archived && (
        <Alert tone="warning" title="This Careers page is archived" className={styles.notice}>
          It is not on the website. Reopen it as a draft to edit it.
          {canEdit && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={async () => {
                try {
                  const next = await careersApi.update(view.revision, { status: "draft" });
                  setView(next);
                  setDraft(draftOf(next));
                  toast({ title: "Reopened as a draft" });
                } catch (caught) {
                  setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
                }
              }}>
                Reopen as draft
              </Button>
            </span>
          )}
        </Alert>
      )}
      {problem && (
        <Alert tone={problem.kind === "conflict" ? "warning" : "danger"} role="alert" className={styles.notice} title={problem.kind === "conflict" ? "Changed elsewhere" : undefined}>
          {problem.message}
          {problem.kind === "conflict" && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={load}>
                Reload latest
              </Button>
              <span className={styles.muted}> Your unsaved edits will be discarded.</span>
            </span>
          )}
        </Alert>
      )}
      <div className={styles.sections}>
        <Panel title="Page header" as="h2">
          <div className={styles.fields}>
            <FormField label="Kicker" helper="Optional. A short label above the title." disabled={readOnly} error={err("kicker")}>
              <Input maxLength={60} value={draft.kicker ?? ""} onChange={(e) => set({ kicker: e.target.value || undefined })} />
            </FormField>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={120} value={draft.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
            </FormField>
            <FormField label="Opening line" required disabled={readOnly} error={err("intro")}>
              <Textarea rows={2} maxLength={400} value={draft.intro ?? ""} onChange={(e) => set({ intro: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        {sectionField("why", "Why work with us", "Why work with us")}
        <Panel title="Open opportunities" as="h2" description="The open roles, listed by title in this order. With none, the page shows the line below — and is not indexed by search engines.">
          <div className={styles.fields}>
            <FormField label="Heading" required disabled={readOnly} error={err("opportunities.heading")}>
              <Input maxLength={160} value={opportunities.heading} onChange={(e) => setOpportunities({ heading: e.target.value })} />
            </FormField>
            <FormField label="When there is no open role" required helper="Shown in place of the list while it is empty." disabled={readOnly} error={err("opportunities.empty")}>
              <Input maxLength={300} value={opportunities.empty} onChange={(e) => setOpportunities({ empty: e.target.value })} />
            </FormField>
            <ItemList
              label="Open roles"
              items={opportunities.roles}
              max={30}
              disabled={readOnly}
              error={err("opportunities.roles")}
              itemLabel={(i) => `Role ${i + 1}`}
              addLabel="Add a role"
              onChange={(roles) => setOpportunities({ roles })}
              make={() => ({ title: "" })}
              render={(role, setRole, i) => <TextField label={`Role ${i + 1} title`} required helper="Only a real, open role." max={160} value={role.title} onChange={(title) => setRole({ title: title ?? "" })} error={err(`opportunities.roles.${i}.title`)} disabled={readOnly} />}
            />
          </div>
        </Panel>
        {sectionField("apply", "How to apply", "How to apply")}
        <Panel title="Closing" as="h2">
          <div className={styles.fields}>
            <FormField label="Heading" required disabled={readOnly} error={err("closing.heading")}>
              <Input maxLength={160} value={closing.heading} onChange={(e) => set({ closing: { ...closing, heading: e.target.value } })} />
            </FormField>
            <LinkField label="Main button" value={closing.primary} onChange={(primary) => set({ closing: { ...closing, primary: primary! } })} error={sub(err, "closing.primary")} disabled={readOnly} />
            <LinkField label="Second button" optional value={closing.secondary} onChange={(secondary) => set({ closing: clean({ ...closing, secondary }) })} error={sub(err, "closing.secondary")} disabled={readOnly} />
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the title and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="Careers page" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view the Careers page but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      {canEdit && !archived && (
        <div className={styles.saveBar} data-dirty={dirty || undefined}>
          <span className={styles.saveState} aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : record ? `Saved · last by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}` : "Not saved yet"}
          </span>
          <span className={styles.saveActions}>
            {record && canArchive && (
              <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(draftOf(view));
                setErrors(new Map());
                setProblem(null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={!dirty && !saving} onClick={save}>
              {record ? "Save" : "Create Careers page"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive the Careers page?"
        description="Archived, it leaves the website at the next publish, and the website shows its own Careers page again."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)}>Cancel</Button>
            <Button variant="destructive" onClick={archive}>
              Archive
            </Button>
          </>
        }
      />
    </PageContainer>
  );
}
