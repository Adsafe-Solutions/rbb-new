import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FileCheck, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, TextField } from "../../blocks/fields";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { transparencyApi, type Transparency, type TransparencyParts, type TransparencyView } from "../../transparency/client";
import { slugify } from "../posts/slug";
import { PublishPanel } from "../settings/PublishPanel";
import styles from "../../content/content.module.css";

/* /transparency — the Transparency chapter of the website's About page
   (/about#transparency): its words, the financial overview, governance
   and "How we report". One per organization: no list, just this editor.
   Its documents are a list of their own (/transparency/documents). Until
   it is PUBLISHED (and an owner publishes the site), the website keeps
   its own transparency content.

   Saves send whole parts with the revision they were based on; a stale
   one offers "Reload latest". Shares are of the total, never amounts, and
   must add up to 100%. */

type Draft = Partial<TransparencyParts> & { status?: Transparency["status"] };
const PARTS = ["kicker", "heading", "intro", "financialOverview", "governance", "accountability"] as const;
const year = new Date().getFullYear();
const INITIAL: Draft = { heading: "", intro: "", financialOverview: { year, verification: "pending-review", items: [] } };
const draftOf = (view: TransparencyView): Draft => (view.record ? structuredClone(view.record) : structuredClone(INITIAL));

export default function TransparencyPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<TransparencyView | null>(null);
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
      const v = await transparencyApi.get();
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

  if (loadFailed) return <PageContainer width="narrow"><EmptyState title="Transparency could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading transparency" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status);
  const err = (path: string) => errors.get(path);
  const set = (changes: Draft) => setDraft((d) => ({ ...d, ...changes }));
  const overview = draft.financialOverview ?? INITIAL.financialOverview!;
  const setOverview = (changes: Partial<Transparency["financialOverview"]>) => set({ financialOverview: { ...overview, ...changes } });
  const total = overview.items.reduce((sum, item) => sum + (Number.isFinite(item.percentage) ? item.percentage : 0), 0);
  const governance = draft.governance;
  const setGovernance = (changes: Partial<NonNullable<Transparency["governance"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...governance, ...changes }).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
    set({ governance: next as Transparency["governance"] });
  };

  async function save() {
    if (!view) return;
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const parts = view.record ? changed : PARTS.filter((p) => draft[p] !== undefined);
      const changes = Object.fromEntries(parts.map((p) => [p, draft[p] ?? null]));
      const next = await transparencyApi.update(view.revision, changes);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: view.record ? "Saved" : "Transparency created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention before this can be saved." : caught.message });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: "Transparency could not be saved. Try again." });
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
      const next = await transparencyApi.schedule(view.revision, input);
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
      const next = await transparencyApi.unschedule(view.revision);
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
      const next = await transparencyApi.act(action, view.revision);
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
      else setProblem({ kind: "error", message: "Transparency could not be changed. Try again." });
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      const next = await transparencyApi.archive();
      setView(next);
      setDraft(draftOf(next));
      toast({ title: "Transparency archived", description: "The website keeps its own transparency content after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "Transparency could not be archived. Try again." });
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Transparency"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The Transparency chapter of the About page. Until it is published here, the website keeps its own."}
        actions={
          <Button leadingIcon={<FileCheck />} onClick={() => navigate("/transparency/documents")}>
            Documents
          </Button>
        }
      />
      {publish?.settingsReady && (
        <div className={styles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {archived && (
        <Alert tone="warning" title="This transparency content is archived" className={styles.notice}>
          It is not on the website. Reopen it as a draft to edit it.
          {canEdit && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={async () => {
                try {
                  const next = await transparencyApi.update(view.revision, { status: "draft" });
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
        <Panel title="The chapter" as="h2" description="The heading and opening line of the Transparency chapter on the About page.">
          <div className={styles.fields}>
            <FormField label="Kicker" helper="Optional. A short label above the heading." disabled={readOnly} error={err("kicker")}>
              <Input maxLength={60} value={draft.kicker ?? ""} onChange={(e) => set({ kicker: e.target.value || undefined })} />
            </FormField>
            <FormField label="Heading" required disabled={readOnly} error={err("heading")}>
              <Input maxLength={160} value={draft.heading ?? ""} onChange={(e) => set({ heading: e.target.value })} />
            </FormField>
            <FormField label="Opening line" required disabled={readOnly} error={err("intro")}>
              <Textarea rows={2} maxLength={400} value={draft.intro ?? ""} onChange={(e) => set({ intro: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Financial overview" as="h2" description="The year's spending as shares of the total, exactly as the organization's own materials give them — never amounts.">
          <div className={styles.fields}>
            <div className={styles.row}>
              <FormField label="Year" required disabled={readOnly} error={err("financialOverview.year")}>
                <Input type="number" min={2000} max={2100} value={Number.isFinite(overview.year) ? overview.year : ""} onChange={(e) => setOverview({ year: e.target.valueAsNumber })} />
              </FormField>
              <FormField label="Verification" helper="Shown while awaiting verification; the release stays blocked until it is verified." disabled={readOnly} error={err("financialOverview.verification")}>
                <Select
                  options={[
                    { value: "pending-review", label: "Awaiting verification" },
                    { value: "verified", label: "Verified by the organization" },
                  ]}
                  value={overview.verification}
                  onChange={(e) => setOverview({ verification: e.target.value as Transparency["financialOverview"]["verification"] })}
                />
              </FormField>
            </div>
            <ItemList
              label="Shares"
              items={overview.items}
              max={6}
              disabled={readOnly}
              error={err("financialOverview.items")}
              itemLabel={(i) => `Share ${i + 1}`}
              addLabel="Add a share"
              onChange={(items) => setOverview({ items })}
              make={() => ({ id: `share-${overview.items.length + 1}`, label: "", percentage: 0 })}
              render={(item, setItem, i) => (
                <div className={styles.row}>
                  <TextField label="What it is" required max={60} value={item.label} onChange={(label) => setItem({ ...item, label: label ?? "", id: slugify(label ?? "") || item.id })} error={err(`financialOverview.items.${i}.label`) ?? err(`financialOverview.items.${i}.id`)} disabled={readOnly} />
                  <FormField label="Share of the total (%)" required disabled={readOnly} error={err(`financialOverview.items.${i}.percentage`)}>
                    <Input type="number" min={0} max={100} value={Number.isFinite(item.percentage) ? item.percentage : ""} onChange={(e) => setItem({ ...item, percentage: e.target.valueAsNumber })} />
                  </FormField>
                </div>
              )}
            />
            <p className={styles.muted} aria-live="polite">
              The shares add up to {total}%{total === 100 ? "." : " — they must add up to 100%."}
            </p>
          </div>
        </Panel>
        <Panel title="Governance" as="h2" description="How the organization is governed. Leave it out until there is an approved statement: the website then says it will be published once approved.">
          <div className={styles.fields}>
            <Checkbox label="Include governance" checked={Boolean(governance)} disabled={readOnly} onChange={(e) => set({ governance: e.target.checked ? ({ intro: "" } as Transparency["governance"]) : undefined })} />
            {governance && (
              <>
                <FormField label="Passage" helper="Optional if there are headed paragraphs below." disabled={readOnly} error={err("governance.intro") ?? err("governance")}>
                  <Textarea rows={3} maxLength={1200} value={governance.intro ?? ""} onChange={(e) => setGovernance({ intro: e.target.value })} />
                </FormField>
                <ItemList
                  label="Headed paragraphs"
                  items={governance.sections ?? []}
                  max={12}
                  disabled={readOnly}
                  error={err("governance.sections")}
                  itemLabel={(i) => `Paragraph ${i + 1}`}
                  addLabel="Add a headed paragraph"
                  onChange={(sections) => setGovernance({ sections })}
                  make={() => ({ heading: "", body: "" })}
                  render={(item, setItem, i) => (
                    <div className={styles.fields}>
                      <TextField label="Heading" required max={120} value={item.heading} onChange={(heading) => setItem({ ...item, heading: heading ?? "" })} error={err(`governance.sections.${i}.heading`)} disabled={readOnly} />
                      <TextField label="Text" required multiline max={1200} value={item.body} onChange={(body) => setItem({ ...item, body: body ?? "" })} error={err(`governance.sections.${i}.body`)} disabled={readOnly} />
                    </div>
                  )}
                />
              </>
            )}
          </div>
        </Panel>
        <Panel title="How we report" as="h2" description="Paragraphs on how the organization reports. Leave empty to leave the passage out.">
          <div className={styles.fields}>
            <FormField label="Paragraphs" helper="Separate paragraphs with a blank line." disabled={readOnly} error={err("accountability") ?? err("accountability.0")}>
              <Textarea rows={6} value={(draft.accountability ?? []).join("\n\n")} onChange={(e) => {
                const paragraphs = e.target.value.split(/\n{2,}/).map((p) => p.replace(/\n/g, " "));
                set({ accountability: paragraphs.join("").trim() ? (paragraphs as Transparency["accountability"]) : undefined });
              }} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="transparency record" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view transparency but not change it.</Alert>}
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
              {record ? "Save" : "Create transparency"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive transparency?"
        description="Archived, it leaves the website at the next publish, and the website shows its own transparency content again."
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
