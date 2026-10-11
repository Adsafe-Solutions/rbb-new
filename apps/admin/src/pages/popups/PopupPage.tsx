import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, AppWindow, Archive, Button, Checkbox, Dialog, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ImageField } from "../../blocks/fields";
import { publishApi, settingsApi, type PublishStatus, type SettingsView } from "../../settings/client";
import { popupApi, type PopupView } from "../../popups/client";
import { changedParts, draftOf, newKey, payloadOf, popupProblems, type PopupDraft } from "../../popups/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import blockStyles from "../../blocks/blocks.module.css";

/* /popups — the website's on-screen popup (M22): a photograph, a kicker,
   a heading with an optional highlight, a line, one call to action and
   the close button's words. One popup per organization, written,
   approved, scheduled and published as a whole. Until it is published
   here, the website keeps its own popup.

   Whether the popup shows at all is the organization's setting
   (engagement.popup) — owners change it under "Display"; like every
   setting it reaches the website with the next publish. */

export default function PopupPage() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const canSetDisplay = useCan("settings:write");
  const { toast } = useToast();
  const [view, setView] = useState<PopupView | null>(null);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<PopupDraft>(() => draftOf(null));
  const [showPopup, setShowPopup] = useState<boolean | null>(null);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);

  const show = useCallback((next: PopupView) => {
    setView(next);
    setDraft(draftOf(next.record));
  }, []);
  const showSettings = useCallback((next: SettingsView | null) => {
    setSettings(next);
    setShowPopup(next ? next.settings.engagement.popup.enabled : null);
  }, []);
  /* Only the latest load is shown: an earlier one answering late (React's
     development double effects, a quick reload) must never overwrite
     what someone has typed since. */
  const loads = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loads.current;
    setProblem(null);
    setErrors(new Map());
    try {
      const [v, s] = await Promise.all([popupApi.get(), settingsApi.get()]);
      if (generation !== loads.current) return;
      show(v);
      showSettings(s);
      setLoadFailed(false);
    } catch {
      if (generation === loads.current) setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [show, showSettings]);
  useEffect(() => void load(), [load]);

  const savedPayload = useMemo(() => (view?.record ? payloadOf(draftOf(view.record)) : null), [view]);
  const changes = changedParts(payloadOf(draft), savedPayload);
  const dirty = view?.record ? Object.keys(changes).length > 0 : true;
  const displayDirty = settings !== null && showPopup !== null && showPopup !== settings.settings.engagement.popup.enabled;
  useEffect(() => {
    if (!(view?.record && dirty) && !displayDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [view, dirty, displayDirty]);

  if (loadFailed)
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={AppWindow} title="The popup could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading the popup" /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status) || archived;
  const err = (path: string) => errors.get(path);
  const set = (c: Partial<PopupDraft>) => setDraft((d) => ({ ...d, ...c }));
  const failed = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
    else if (caught instanceof ApiRequestError && caught.status === 400) {
      setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, "").replace(/^media\..*$/, "imageId"), d.message])));
      setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention first." : caught.message });
    } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
    else setProblem({ kind: "error", message: fallback });
  };

  async function save() {
    if (!view) return;
    const local = popupProblems(draft);
    if (local.size) {
      setErrors(local);
      setProblem({ kind: "invalid", message: "Some fields need attention before this can be saved." });
      return;
    }
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await popupApi.update(view.revision, view.record ? changes : { ...payloadOf(draft) }));
      toast({ title: view.record ? "Saved" : "Popup created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "The popup could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDisplay() {
    if (!settings || showPopup === null) return;
    setSavingDisplay(true);
    setProblem(null);
    try {
      const engagement = { ...settings.settings.engagement, popup: { enabled: showPopup } };
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
      show(await popupApi.act(action, view.revision));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, "The popup could not be changed. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      show(await popupApi.schedule(view.revision, input));
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
      show(await popupApi.unschedule(view.revision));
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
      show(await popupApi.archive());
      toast({ title: "Popup archived", description: "The website shows its own popup again after the next publish." });
    } catch {
      setProblem({ kind: "error", message: "The popup could not be archived. Try again." });
    }
  }

  async function reopen() {
    if (!view) return;
    try {
      show(await popupApi.update(view.revision, { status: "draft" }));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Popup"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "The website's on-screen popup. Until one is published here, the website keeps its own."}
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={Boolean(record && dirty) || displayDirty} onPublished={load} />
        </div>
      )}
      {!record && (
        <Alert tone="info" title="No popup yet" className={contentStyles.notice} data-testid="popup-empty">
          Write the popup below and save it as a draft. The website keeps its own popup until this one is published.
        </Alert>
      )}
      {archived && (
        <Alert tone="warning" title="The popup is archived" className={contentStyles.notice}>
          It is not on the website. Reopen it as a draft to edit it.
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
        <Panel title="Content" as="h2" description="Plain text. The popup opens over the page, so keep it short.">
          <div className={contentStyles.fields}>
            <FormField label="Kicker" helper="Optional. A few words above the heading." disabled={readOnly} error={err("kicker")}>
              <Input maxLength={60} value={draft.kicker} onChange={(e) => set({ kicker: e.target.value })} />
            </FormField>
            <FormField label="Heading" required disabled={readOnly} error={err("heading")}>
              <Input maxLength={160} value={draft.heading} onChange={(e) => set({ heading: e.target.value })} />
            </FormField>
            <FormField label="Highlighted words" helper="Optional. Words from the heading to highlight." disabled={readOnly} error={err("highlight")}>
              <Input maxLength={60} value={draft.highlight} onChange={(e) => set({ highlight: e.target.value })} />
            </FormField>
            <FormField label="Line" required helper="Up to 600 characters." disabled={readOnly} error={err("body")}>
              <Textarea rows={3} maxLength={600} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
            </FormField>
            <ImageField label="Photograph" helper="From the media library. It needs alt text (describe it there) before the popup can be submitted." value={draft.imageId || undefined} onChange={(imageId) => set({ imageId: imageId ?? "" })} error={err("imageId")} disabled={readOnly} />
            <fieldset className={blockStyles.group}>
              <legend className={blockStyles.legend}>Call to action</legend>
              <div className={blockStyles.row}>
                <FormField label="Button text" required disabled={readOnly} error={err("cta.label")}>
                  <Input maxLength={80} value={draft.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
                </FormField>
                <FormField label="Page" required helper="A page of this website, like /appeals. Never another site." disabled={readOnly} error={err("cta.href")}>
                  <Input maxLength={300} value={draft.ctaHref} onChange={(e) => set({ ctaHref: e.target.value.trim() })} />
                </FormField>
              </div>
            </fieldset>
            <FormField label="Close-button text" required helper="The second button, which closes the popup — for example, “Maybe later”." disabled={readOnly} error={err("dismissLabel")}>
              <Input maxLength={40} value={draft.dismissLabel} onChange={(e) => set({ dismissLabel: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="When it opens" as="h2" description="It never opens at load, never over another dialog, and never again to a visitor who closed it.">
          <div className={contentStyles.fields}>
            <div className={blockStyles.row}>
              <FormField label="Seconds after arrival" helper="0 to 60." disabled={readOnly} error={err("delayMs")}>
                <Input type="number" min={0} max={60} value={draft.delaySeconds} onChange={(e) => set({ delaySeconds: Number(e.target.value) })} />
              </FormField>
              <FormField label="How often" disabled={readOnly} error={err("frequency")}>
                <Select value={draft.frequency} options={[{ value: "session", label: "Once per visit" }, { value: "once", label: "Once per visitor" }]} onChange={(e) => set({ frequency: e.target.value as PopupDraft["frequency"] })} />
              </FormField>
            </div>
            <FormField label="Never on these pages" helper="One path per line, like /contact. Pages beneath them are left out too." disabled={readOnly} error={err("excludePaths")}>
              <Textarea rows={4} value={draft.excludeText} onChange={(e) => set({ excludeText: e.target.value })} />
            </FormField>
            <FormField label="Popup key" required helper="What a visitor's “closed” is remembered against. Give it a new key to show the popup again to everyone who closed it." disabled={readOnly} error={err("key")}>
              <Input maxLength={120} value={draft.key} onChange={(e) => set({ key: e.target.value.trim() })} />
            </FormField>
            <div>
              <Button size="sm" disabled={readOnly} onClick={() => set({ key: newKey() })}>
                Use a new key
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Display" as="h2" description="Whether the popup shows on the website. A site setting: it reaches the website with the next publish. A deployment can still switch it off.">
          {showPopup !== null ? (
            <div className={contentStyles.fields}>
              <Checkbox label="Show the popup" checked={showPopup} disabled={!canSetDisplay} onChange={(e) => setShowPopup(e.target.checked)} />
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
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="popup" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={contentStyles.muted}>Save it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view the popup but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      {canEdit && !archived && (
        <div className={contentStyles.saveBar} data-dirty={(record && dirty) || undefined}>
          <span className={contentStyles.saveState} aria-live="polite">
            {saving ? "Saving…" : record ? (dirty ? "Unsaved changes" : `Saved · last by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}`) : "Not saved yet"}
          </span>
          <span className={contentStyles.saveActions}>
            {record && canArchive && (
              <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!record || !dirty || saving}
              onClick={() => {
                setDraft(draftOf(view.record));
                setErrors(new Map());
                setProblem(null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={(record ? !dirty : false) || saving || isLocked(record?.status)} onClick={save}>
              {record ? "Save" : "Create popup"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive the popup?"
        description="Archived, it leaves the website at the next publish, and the website shows its own popup again. To hide the popup instead, switch it off under Display."
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
