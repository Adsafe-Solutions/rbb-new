import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Dialog, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, TextField } from "../../blocks/fields";
import { publishApi, type PublishStatus } from "../../settings/client";
import { howWeWorkApi, type HowWeWork, type HowWeWorkParts, type HowWeWorkView } from "../../howWeWork/client";
import { LINE_GLYPHS } from "../../content/glyphs";
import { idFrom } from "../../blocks/ids";
import { PublishPanel } from "../settings/PublishPanel";
import styles from "../../content/content.module.css";

/* /how-we-work — the website's How We Work page (/about/how-we-work, #7):
   its header, the "In practice" cards and the numbered passages. One per
   organization: no list, just this editor. Until it is PUBLISHED (and an
   owner publishes the site), the website keeps its own page.

   The two posters (Our Approach, Transparency), the closing ask and the
   page's SEO stay the site's. The words are RBB's (decision D11): nothing
   is filled in here on its behalf. Saves send whole parts with the
   revision they were based on; a stale one offers "Reload latest". */

type Draft = Partial<HowWeWorkParts> & { status?: HowWeWork["status"] };
const PARTS = ["kicker", "heading", "body", "practices", "rows"] as const;
const INITIAL: Draft = {
  heading: "",
  body: "",
  practices: { heading: "", items: [] },
  rows: [],
};
const draftOf = (view: HowWeWorkView): Draft => (view.record ? structuredClone(view.record) : structuredClone(INITIAL));
type Row = HowWeWork["rows"][number];

export default function HowWeWorkPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<HowWeWorkView | null>(null);
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
      const v = await howWeWorkApi.get();
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

  if (loadFailed) return <PageContainer width="narrow"><EmptyState title="The How We Work page could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading the How We Work page" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status);
  const err = (path: string) => errors.get(path);
  const set = (changes: Draft) => setDraft((d) => ({ ...d, ...changes }));
  const practices = draft.practices ?? INITIAL.practices!;
  const setPractices = (changes: Partial<HowWeWork["practices"]>) => set({ practices: { ...practices, ...changes } });
  const rows = draft.rows ?? [];
  const lineList = (row: Row, setRow: (row: Row) => void, i: number) => (
    <ItemList
      label={`Passage ${i + 1} list`}
      items={row.items ?? []}
      max={12}
      disabled={readOnly}
      error={err(`rows.${i}.items`)}
      itemLabel={(j) => `Line ${j + 1}`}
      addLabel="Add a line"
      onChange={(items) => setRow(items.length ? { ...row, items } : (({ items: _, ...rest }) => rest)(row))}
      make={() => ""}
      render={(line, setLine, j) => <TextField label={`Line ${j + 1}`} required max={300} value={line} onChange={(v) => setLine(v ?? "")} error={err(`rows.${i}.items.${j}`)} disabled={readOnly} />}
    />
  );

  async function save() {
    if (!view) return;
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const parts = view.record ? changed : PARTS.filter((p) => draft[p] !== undefined);
      const changes = Object.fromEntries(parts.map((p) => [p, draft[p] ?? null]));
      const next = await howWeWorkApi.update(view.revision, changes);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: view.record ? "Saved" : "How We Work page created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention before this can be saved." : caught.message });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: "The How We Work page could not be saved. Try again." });
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
      const next = await howWeWorkApi.schedule(view.revision, input);
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
      const next = await howWeWorkApi.unschedule(view.revision);
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
      const next = await howWeWorkApi.act(action, view.revision);
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
      else setProblem({ kind: "error", message: "The How We Work page could not be changed. Try again." });
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      const next = await howWeWorkApi.archive();
      setView(next);
      setDraft(draftOf(next));
      toast({ title: "How We Work page archived", description: "The website keeps its own How We Work page after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "The How We Work page could not be archived. Try again." });
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="How We Work page"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The website's How We Work page (/about/how-we-work). Until it is published here, the website keeps its own."}
      />
      {publish?.settingsReady && (
        <div className={styles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {archived && (
        <Alert tone="warning" title="This How We Work page is archived" className={styles.notice}>
          It is not on the website. Reopen it as a draft to edit it.
          {canEdit && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={async () => {
                try {
                  const next = await howWeWorkApi.update(view.revision, { status: "draft" });
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
            <FormField label="Kicker" helper="Optional. A short label above the heading." disabled={readOnly} error={err("kicker")}>
              <Input maxLength={60} value={draft.kicker ?? ""} onChange={(e) => set({ kicker: e.target.value || undefined })} />
            </FormField>
            <FormField label="Heading" required disabled={readOnly} error={err("heading")}>
              <Input maxLength={120} value={draft.heading ?? ""} onChange={(e) => set({ heading: e.target.value })} />
            </FormField>
            <FormField label="Opening line" required disabled={readOnly} error={err("body")}>
              <Textarea rows={2} maxLength={400} value={draft.body ?? ""} onChange={(e) => set({ body: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="In practice" as="h2" description="Cards, each a title, a line and a glyph. The page header shows the cards' glyphs together. With none, the section shows no cards.">
          <div className={styles.fields}>
            <FormField label="Kicker" helper="Optional." disabled={readOnly} error={err("practices.kicker")}>
              <Input maxLength={60} value={practices.kicker ?? ""} onChange={(e) => setPractices({ kicker: e.target.value || undefined })} />
            </FormField>
            <FormField label="Heading" required disabled={readOnly} error={err("practices.heading")}>
              <Input maxLength={160} value={practices.heading} onChange={(e) => setPractices({ heading: e.target.value })} />
            </FormField>
            <ItemList
              label="Cards"
              items={practices.items}
              max={8}
              disabled={readOnly}
              error={err("practices.items")}
              itemLabel={(i) => `Card ${i + 1}`}
              addLabel="Add a card"
              onChange={(items) => setPractices({ items })}
              make={() => ({ title: "", description: "", icon: "community" as const })}
              render={(item, setItem, i) => (
                <div className={styles.fields}>
                  <TextField label={`Card ${i + 1} title`} required max={120} value={item.title} onChange={(title) => setItem({ ...item, title: title ?? "" })} error={err(`practices.items.${i}.title`)} disabled={readOnly} />
                  <TextField label="Line" required multiline max={300} value={item.description} onChange={(description) => setItem({ ...item, description: description ?? "" })} error={err(`practices.items.${i}.description`)} disabled={readOnly} />
                  <FormField label="Glyph" disabled={readOnly} error={err(`practices.items.${i}.icon`)}>
                    <Select options={LINE_GLYPHS} value={item.icon} onChange={(e) => setItem({ ...item, icon: e.target.value as typeof item.icon })} />
                  </FormField>
                </div>
              )}
            />
          </div>
        </Panel>
        <Panel title="Passages" as="h2" description="The numbered passages beneath the cards, in order: a heading, a passage and an optional list.">
          <div className={styles.fields}>
            <ItemList
              label="Passages"
              items={rows}
              max={8}
              disabled={readOnly}
              error={err("rows")}
              itemLabel={(i) => `Passage ${i + 1}`}
              addLabel="Add a passage"
              onChange={(next) => set({ rows: next })}
              make={() => ({ id: "", heading: "", body: "" })}
              render={(row, setRow, i) => (
                <div className={styles.fields}>
                  <TextField label={`Passage ${i + 1} heading`} required max={160} value={row.heading} onChange={(heading) => setRow({ ...row, heading: heading ?? "", id: idFrom(heading ?? "", rows.filter((_, j) => j !== i), "passage") })} error={err(`rows.${i}.heading`) ?? err(`rows.${i}.id`)} disabled={readOnly} />
                  <TextField label="Passage" required multiline max={1200} value={row.body} onChange={(body) => setRow({ ...row, body: body ?? "" })} error={err(`rows.${i}.body`)} disabled={readOnly} />
                  {lineList(row, setRow, i)}
                </div>
              )}
            />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="How We Work page" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view the How We Work page but not change it.</Alert>}
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
              {record ? "Save" : "Create How We Work page"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive the How We Work page?"
        description="Archived, it leaves the website at the next publish, and the website shows its own How We Work page again."
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
