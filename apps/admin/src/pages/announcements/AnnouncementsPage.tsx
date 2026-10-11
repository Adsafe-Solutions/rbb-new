import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FormField, Input, Megaphone, PageContainer, PageHeader, Panel, Spinner, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList } from "../../blocks/fields";
import { publishApi, settingsApi, type PublishStatus, type SettingsView } from "../../settings/client";
import { announcementBarApi, type AnnouncementBarView } from "../../announcements/client";
import { MAX_LINK_LABEL, MAX_MESSAGES, MAX_TEXT, draftOf, emptyMessage, intervalProblem, messageProblems, payloadOf, secondsOf, type MessageDraft } from "../../announcements/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import blockStyles from "../../blocks/blocks.module.css";

/* /announcements — the announcement bar over the website's header (M21):
   its messages, in the order they rotate. One bar per organization,
   written, approved, scheduled and published as a whole. Until it is
   published here, the website keeps its own messages.

   Whether the bar shows at all, and how long each message stays, are the
   organization's settings (engagement.announcementBar) — owners change
   them in "Display" below; like every setting they reach the website with
   the next publish. */

export default function AnnouncementsPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const canSetDisplay = useCan("settings:write");
  const { toast } = useToast();
  const [view, setView] = useState<AnnouncementBarView | null>(null);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<MessageDraft[]>([]);
  const [display, setDisplay] = useState<{ enabled: boolean; seconds: number } | null>(null);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);

  const show = useCallback((next: AnnouncementBarView) => {
    setView(next);
    setDraft(draftOf(next.record?.items));
  }, []);
  const showSettings = useCallback((next: SettingsView | null) => {
    setSettings(next);
    const bar = next?.settings.engagement.announcementBar;
    setDisplay(bar ? { enabled: bar.enabled, seconds: secondsOf(bar.intervalMs) } : null);
  }, []);
  const load = useCallback(async () => {
    setProblem(null);
    setErrors(new Map());
    try {
      const [v, s] = await Promise.all([announcementBarApi.get(), settingsApi.get()]);
      show(v);
      showSettings(s);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [show, showSettings]);
  useEffect(() => void load(), [load]);

  const saved = useMemo(() => JSON.stringify(payloadOf(draftOf(view?.record?.items))), [view]);
  const dirty = JSON.stringify(payloadOf(draft)) !== saved;
  const savedDisplay = settings?.settings.engagement.announcementBar;
  const displayDirty = Boolean(display && savedDisplay && (display.enabled !== savedDisplay.enabled || display.seconds * 1000 !== savedDisplay.intervalMs));
  useEffect(() => {
    if (!dirty && !displayDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, displayDirty]);

  if (loadFailed)
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={Megaphone} title="The announcement bar could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading the announcement bar" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status) || archived;
  const err = (path: string) => errors.get(path);
  const failed = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
    else if (caught instanceof ApiRequestError && caught.status === 400) {
      setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
      setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention first." : caught.message });
    } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
    else setProblem({ kind: "error", message: fallback });
  };

  async function save() {
    if (!view) return;
    const local = messageProblems(draft);
    if (local.size) {
      setErrors(local);
      setProblem({ kind: "invalid", message: "Some fields need attention before this can be saved." });
      return;
    }
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await announcementBarApi.update(view.revision, { items: payloadOf(draft) }));
      toast({ title: view.record ? "Saved" : "Announcement bar created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "The announcement bar could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDisplay() {
    if (!settings || !display || intervalProblem(display.seconds)) return;
    setSavingDisplay(true);
    setProblem(null);
    try {
      const engagement = { ...settings.settings.engagement, announcementBar: { enabled: display.enabled, intervalMs: display.seconds * 1000 } };
      showSettings(await settingsApi.update(settings.revision, { engagement }));
      toast({ title: "Display settings saved", description: "They reach the website with the next publish.", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "The display settings could not be saved." });
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
      show(await announcementBarApi.act(action, view.revision));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "The announcement bar could not be changed. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      show(await announcementBarApi.schedule(view.revision, input));
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
      show(await announcementBarApi.unschedule(view.revision));
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
      show(await announcementBarApi.archive());
      toast({ title: "Announcement bar archived", description: "The website shows its own messages again after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "The announcement bar could not be archived. Try again." });
    }
  }

  async function reopen() {
    if (!view) return;
    try {
      show(await announcementBarApi.update(view.revision, { status: "draft" }));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    }
  }

  const message = (m: MessageDraft, set: (m: MessageDraft) => void, i: number) => (
    <div className={blockStyles.fields}>
      <FormField label={`Message ${i + 1}`} required helper={`One line on a phone: up to ${MAX_TEXT} characters.`} disabled={readOnly} error={err(`items.${i}.text`)}>
        <Input maxLength={MAX_TEXT} value={m.text} onChange={(e) => set({ ...m, text: e.target.value })} />
      </FormField>
      <Checkbox label="Add a link" checked={m.linkOn} disabled={readOnly} onChange={(e) => set({ ...m, linkOn: e.target.checked })} />
      {m.linkOn && (
        <div className={blockStyles.row}>
          <FormField label="Link text" required disabled={readOnly} error={err(`items.${i}.link.label`)}>
            <Input maxLength={MAX_LINK_LABEL} value={m.label} onChange={(e) => set({ ...m, label: e.target.value })} />
          </FormField>
          <FormField label="Page" required helper="A page of this website, like /appeals. Never another site." disabled={readOnly} error={err(`items.${i}.link.href`)}>
            <Input maxLength={300} value={m.href} onChange={(e) => set({ ...m, href: e.target.value.trim() })} />
          </FormField>
        </div>
      )}
    </div>
  );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Announcement bar"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The short messages that rotate over the website's header. Until they are published here, the website keeps its own."}
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={dirty || displayDirty} onPublished={load} />
        </div>
      )}
      {archived && (
        <Alert tone="warning" title="The announcement bar is archived" className={contentStyles.notice}>
          Its messages are not on the website. Reopen it as a draft to edit it.
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
        <Panel title="Messages" as="h2" description={`In the order the bar shows them, up to ${MAX_MESSAGES}. At least one is required to approve.`}>
          {draft.length === 0 && <p className={contentStyles.muted} data-testid="bar-empty">No messages yet. The website keeps its own until messages are published here.</p>}
          <ItemList label="Messages" items={draft} max={MAX_MESSAGES} disabled={readOnly} error={err("items")} itemLabel={(i) => `Message ${i + 1}`} addLabel="Add a message" onChange={setDraft} make={emptyMessage} render={message} />
        </Panel>
        <Panel title="Display" as="h2" description="Whether the bar shows on the website, and how long each message stays. Site settings: they reach the website with the next publish. A deployment can still switch the bar off, and it never shows without a message.">
          {display ? (
            <div className={contentStyles.fields}>
              <Checkbox label="Show the announcement bar" checked={display.enabled} disabled={!canSetDisplay} onChange={(e) => setDisplay({ ...display, enabled: e.target.checked })} />
              <FormField label="Seconds per message" helper="2 to 30." disabled={!canSetDisplay} error={intervalProblem(display.seconds) ?? undefined}>
                <Input type="number" min={2} max={30} value={display.seconds} onChange={(e) => setDisplay({ ...display, seconds: Number(e.target.value) })} />
              </FormField>
              {canSetDisplay ? (
                <div>
                  <Button loading={savingDisplay} disabled={!displayDirty || savingDisplay || Boolean(intervalProblem(display.seconds))} onClick={saveDisplay}>
                    Save display settings
                  </Button>
                </div>
              ) : (
                <p className={contentStyles.muted}>Only an owner can change these.</p>
              )}
            </div>
          ) : (
            <p className={contentStyles.muted}>The organization's settings have not been imported yet.</p>
          )}
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={contentStyles.fields}>
            {record && !archived && record.status !== "published" && payloadOf(draft).length === 0 && (
              <Alert tone="info" data-testid="bar-gaps">
                Before it can be approved it needs at least one message.
              </Alert>
            )}
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="announcement bar" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={contentStyles.muted}>Save it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view the announcement bar but not change it.</Alert>}
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
                setDraft(draftOf(view.record?.items));
                setErrors(new Map());
                setProblem(null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={(record ? !dirty : false) || saving || isLocked(record?.status)} onClick={save}>
              {record ? "Save" : "Create announcement bar"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive the announcement bar?"
        description="Archived, its messages leave the website at the next publish, and the website shows its own messages again. To hide the bar instead, switch it off under Display."
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
