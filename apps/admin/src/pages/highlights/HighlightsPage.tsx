import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FormField, PageContainer, PageHeader, Panel, Select, Sparkles, Spinner, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import { appealsApi, type ScheduleInput, type WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked, readinessWord } from "../../content/workflow";
import { ItemList } from "../../blocks/fields";
import { publishApi, settingsApi, type PublishStatus, type SettingsView } from "../../settings/client";
import { storyStripApi, type StoryStripView } from "../../highlights/client";
import { STRIP_LIMIT, circleLabel, draftOf, notReady, payloadOf, stripProblems, type AppealOption, type CircleDraft } from "../../highlights/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";

/* /highlights — the story circles over the website's navbar (M23): which
   appeals they show, in order, up to four. Written, approved, scheduled
   and published as a whole. Each circle's label and photograph are the
   appeal's own (its "Story circle" settings in the appeal editor). Until
   a strip is published here, the website keeps its rule: the appeals
   marked for the story circles, newest first.

   Whether the strip shows at all is the organization's setting
   (engagement.storyStrip) — owners change it under "Display". */

export default function HighlightsPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const canSetDisplay = useCan("settings:write");
  const { toast } = useToast();
  const [view, setView] = useState<StoryStripView | null>(null);
  const [appeals, setAppeals] = useState<AppealOption[] | null>(null);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<CircleDraft[]>([]);
  const [showStrip, setShowStrip] = useState<boolean | null>(null);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);

  const show = useCallback((next: StoryStripView) => {
    setView(next);
    setDraft(draftOf(next.record?.appealIds));
  }, []);
  const showSettings = useCallback((next: SettingsView | null) => {
    setSettings(next);
    setShowStrip(next ? next.settings.engagement.storyStrip.enabled : null);
  }, []);
  /* Only the latest load is shown: an earlier one answering late must never
     overwrite what someone has chosen since. */
  const loads = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loads.current;
    setProblem(null);
    setErrors(new Map());
    try {
      const [v, list, s] = await Promise.all([storyStripApi.get(), appealsApi.list({ pageSize: 100, sort: "updated" }), settingsApi.get()]);
      if (generation !== loads.current) return;
      show(v);
      setAppeals(
        list.items
          .filter((a) => a.record.status !== "archived")
          .map((a) => ({ id: a.record.id, title: a.record.title, status: a.record.status, live: a.live, circleLabel: a.record.highlight?.label }))
      );
      showSettings(s);
      setLoadFailed(false);
    } catch {
      if (generation === loads.current) setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [show, showSettings]);
  useEffect(() => void load(), [load]);

  const saved = useMemo(() => JSON.stringify(view?.record?.appealIds ?? []), [view]);
  const dirty = JSON.stringify(payloadOf(draft)) !== saved;
  const displayDirty = settings !== null && showStrip !== null && showStrip !== settings.settings.engagement.storyStrip.enabled;
  useEffect(() => {
    if (!dirty && !displayDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, displayDirty]);

  if (loadFailed)
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={Sparkles} title="Highlights could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );
  if (!view || !appeals) return <PageContainer width="narrow"><Spinner label="Loading Highlights" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status) || archived;
  const err = (path: string) => errors.get(path);
  const byId = new Map(appeals.map((a) => [a.id, a]));
  const pending = notReady(draft, appeals);
  const failed = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
    else if (caught instanceof ApiRequestError && caught.status === 400) {
      setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
      setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some circles need attention first." : caught.message });
    } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
    else setProblem({ kind: "error", message: fallback });
  };

  async function save() {
    if (!view) return;
    const local = stripProblems(draft, appeals ?? []);
    if (local.size) {
      setErrors(local);
      setProblem({ kind: "invalid", message: "Some circles need attention before this can be saved." });
      return;
    }
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await storyStripApi.update(view.revision, { appealIds: payloadOf(draft) }));
      toast({ title: view.record ? "Saved" : "Highlights created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "Highlights could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDisplay() {
    if (!settings || showStrip === null) return;
    setSavingDisplay(true);
    setProblem(null);
    try {
      const engagement = { ...settings.settings.engagement, storyStrip: { enabled: showStrip } };
      showSettings(await settingsApi.update(settings.revision, { engagement }));
      toast({ title: "Display setting saved", description: "It reaches the website with the next publish.", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "The display setting could not be saved." });
    } finally {
      setSavingDisplay(false);
    }
  }

  async function act(action: WorkflowAction) {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await storyStripApi.act(action, view.revision));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "Highlights could not be changed. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      show(await storyStripApi.schedule(view.revision, input));
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
      show(await storyStripApi.unschedule(view.revision));
      toast({ title: "Unscheduled", description: "It stays approved." });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      show(await storyStripApi.archive());
      toast({ title: "Highlights archived", description: "The website goes back to its own rule after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "Highlights could not be archived. Try again." });
    }
  }

  async function reopen() {
    if (!view) return;
    try {
      show(await storyStripApi.update(view.revision, { status: "draft" }));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    }
  }

  const choose = [{ value: "", label: "Choose an appeal" }, ...appeals.map((a) => ({ value: a.id, label: `${a.title} (${readinessWord(a.status, a.live)})` }))];
  const circle = (row: CircleDraft, set: (r: CircleDraft) => void, i: number) => (
    <FormField label={`Appeal for circle ${i + 1}`} required helper={row.appealId && byId.get(row.appealId) ? `The circle reads “${circleLabel(byId.get(row.appealId))}” — change it in the appeal's Story circle settings.` : undefined} disabled={readOnly} error={err(`appealIds.${i}`)}>
      <Select value={row.appealId} options={row.appealId && !byId.has(row.appealId) ? [...choose, { value: row.appealId, label: "(archived or missing)" }] : choose} onChange={(e) => set({ appealId: e.target.value })} />
    </FormField>
  );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Highlights"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The story circles over the website's navbar: which appeals they show, in order. Until this is published, the website shows the appeals marked for the circles, newest first."}
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={dirty || displayDirty} onPublished={load} />
        </div>
      )}
      {appeals.length === 0 && (
        <Alert tone="info" title="No appeals yet" className={contentStyles.notice} data-testid="strip-no-appeals">
          The circles show appeals. Create an appeal first, then choose it here.
        </Alert>
      )}
      {archived && (
        <Alert tone="warning" title="Highlights are archived" className={contentStyles.notice}>
          The website uses its own rule for the circles. Reopen as a draft to edit.
          {canEdit && (
            <span className={contentStyles.inlineAction}>
              <Button size="sm" onClick={reopen}>
                Reopen as draft
              </Button>
            </span>
          )}
        </Alert>
      )}
      {problem && (
        <Alert tone={problem.kind === "conflict" ? "warning" : "danger"} role="alert" className={contentStyles.notice} title={problem.kind === "conflict" ? "Changed elsewhere" : undefined}>
          {problem.message}
          {problem.kind === "conflict" && (
            <span className={contentStyles.inlineAction}>
              <Button size="sm" onClick={load}>
                Reload latest
              </Button>
              <span className={contentStyles.muted}> Your unsaved edits will be discarded.</span>
            </span>
          )}
        </Alert>
      )}
      <div className={contentStyles.sections}>
        <Panel title="Circles" as="h2" description={`Up to ${STRIP_LIMIT} appeals, in the order the circles show them. Each circle's label and photograph are the appeal's own. At least one is required to approve.`}>
          <div className={contentStyles.fields}>
            {draft.length === 0 && <p className={contentStyles.muted} data-testid="strip-empty">No circles chosen yet.</p>}
            <ItemList label="Circles" items={draft} max={STRIP_LIMIT} disabled={readOnly || appeals.length === 0} error={err("appealIds")} itemLabel={(i) => `Circle ${i + 1}`} addLabel="Add a circle" onChange={setDraft} make={() => ({ appealId: "" })} render={circle} />
            {pending.length > 0 && (
              <Alert tone="info" data-testid="strip-not-ready">
                Approve {pending.map((a) => `“${a.title}”`).join(", ")} before the circles can be submitted for review.
              </Alert>
            )}
          </div>
        </Panel>
        <Panel title="Display" as="h2" description="Whether the circles show on the website. A site setting: it reaches the website with the next publish. A deployment can still switch them off.">
          {showStrip !== null ? (
            <div className={contentStyles.fields}>
              <Checkbox label="Show the story circles" checked={showStrip} disabled={!canSetDisplay} onChange={(e) => setShowStrip(e.target.checked)} />
              {canSetDisplay ? (
                <div>
                  <Button loading={savingDisplay} disabled={!displayDirty || savingDisplay} onClick={saveDisplay}>
                    Save display setting
                  </Button>
                </div>
              ) : (
                <p className={contentStyles.muted}>Only an owner can change this.</p>
              )}
            </div>
          ) : (
            <p className={contentStyles.muted}>The organization's settings have not been imported yet.</p>
          )}
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={contentStyles.fields}>
            {record && !archived && record.status !== "published" && draft.length === 0 && (
              <Alert tone="info" data-testid="strip-gaps">
                Before it can be approved it needs at least one appeal.
              </Alert>
            )}
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="Highlights" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={contentStyles.muted}>Save it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view Highlights but not change them.</Alert>}
          </div>
        </Panel>
      </div>
      {canEdit && !archived && (
        <div className={contentStyles.saveBar} data-dirty={dirty || undefined}>
          <span className={contentStyles.saveState} aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : record ? `Saved · last by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}` : "Not saved yet"}
          </span>
          <span className={contentStyles.saveActions}>
            {record && canArchive && (
              <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(draftOf(view.record?.appealIds));
                setErrors(new Map());
                setProblem(null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={(record ? !dirty : false) || saving || isLocked(record?.status)} onClick={save}>
              {record ? "Save" : "Create Highlights"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive Highlights?"
        description="Archived, they leave the website at the next publish, and the circles go back to the website's own rule. To hide the circles instead, switch them off under Display."
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
