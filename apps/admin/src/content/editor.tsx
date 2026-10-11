import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../api";
import { Alert, Archive, Button, Dialog, useToast } from "../design-system";
import { navigate } from "../router";
import type { ContentStatus, ContentView, ScheduleInput, ScheduleView, WorkflowAction, contentApi } from "./client";
import { ACTED, workflowBadge } from "./workflow";
import styles from "./content.module.css";

/* The editing state of one post or event: load, track unsaved changes,
   save (create or update), and handle what the API says — field errors,
   a stale revision (409 → reload), a published address change (409 →
   confirm), archiving, and the editorial workflow's transitions (M14:
   submit, withdraw, approve, return to draft). The API decides; this
   shows it. */

const SLUG_CHANGE = "This is published at its current address.";
type Api<R> = ReturnType<typeof contentApi<R>>;

export interface EditorState<R> {
  status: "loading" | "missing" | "error" | "ready";
  view: ContentView<R> | null;
  draft: Partial<R>;
  set: (changes: Partial<R>) => void;
  dirty: boolean;
  saving: boolean;
  errors: Map<string, string>;
  problem: { kind: "conflict" | "invalid" | "error"; message: string } | null;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  discard: () => void;
  slugConfirm: { open: boolean; confirm: () => void; cancel: () => void };
  archive: () => Promise<void>;
  reopen: () => Promise<void>;
  act: (action: WorkflowAction) => Promise<void>;
  acting: boolean;
  /* M15 (owners): queue the approved revision for a website publication —
     resolves to a message for the dialog, or null — and drop that. */
  schedule: (input: ScheduleInput) => Promise<string | null>;
  unschedule: () => Promise<void>;
}

export function useContentEditor<R extends { id: string; status: ContentStatus }>(
  { api, id, base, fields, initial, kind }: { api: Api<R>; id: string; base: string; fields: readonly (keyof R & string)[]; initial: Partial<R>; kind: string }
): EditorState<R> {
  const { toast } = useToast();
  const isNew = id === "new";
  const [status, setStatus] = useState<EditorState<R>["status"]>(isNew ? "ready" : "loading");
  const [view, setView] = useState<ContentView<R> | null>(null);
  const [draft, setDraft] = useState<Partial<R>>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<EditorState<R>["problem"]>(null);
  const [slugPending, setSlugPending] = useState(false);
  const [acting, setActing] = useState(false);

  const reload = useCallback(async () => {
    if (isNew) return;
    setProblem(null);
    setErrors(new Map());
    try {
      const v = await api.get(id);
      setView(v);
      setDraft(structuredClone(v.record));
      setStatus("ready");
    } catch (e) {
      setStatus(e instanceof ApiRequestError && e.status === 404 ? "missing" : "error");
    }
  }, [api, id, isNew]);
  useEffect(() => void reload(), [reload]);

  const saved = (view?.record ?? initial) as Partial<R>;
  const changed = useMemo(() => fields.filter((f) => JSON.stringify(draft[f] ?? null) !== JSON.stringify(saved[f] ?? null)), [draft, saved, fields]);
  const dirty = isNew ? fields.some((f) => draft[f] !== undefined && draft[f] !== "" && JSON.stringify(draft[f]) !== JSON.stringify(initial[f])) : changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fail = (caught: unknown, what = "saved") => {
    if (caught instanceof ApiRequestError && caught.status === 409) {
      if (caught.message.startsWith(SLUG_CHANGE)) return setSlugPending(true);
      return setProblem({ kind: "conflict", message: caught.message });
    }
    if (caught instanceof ApiRequestError && caught.status === 400) {
      const map = new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message]));
      setErrors(map);
      return setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? `Some fields need attention before this can be ${what}.` : caught.message });
    }
    if (caught instanceof ApiRequestError && caught.status === 403) return setProblem({ kind: "error", message: caught.message });
    setProblem({ kind: "error", message: `The ${kind} could not be ${what}. Try again.` });
  };

  const save = async (confirmSlugChange = false) => {
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      if (isNew) {
        const body = Object.fromEntries(fields.filter((f) => draft[f] !== undefined && draft[f] !== "").map((f) => [f, draft[f]]));
        const created = await api.create(body);
        toast({ title: `${kind[0]!.toUpperCase()}${kind.slice(1)} created`, tone: "success" });
        navigate(`/${base}/${created.record.id}`, { replace: true });
        return;
      }
      if (!view) return;
      const changes = Object.fromEntries(changed.map((f) => [f, draft[f] === undefined || draft[f] === "" ? null : draft[f]]));
      const next = await api.update(view.record.id, view.revision, changes, confirmSlugChange);
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ title: "Saved", tone: "success" });
    } catch (caught) {
      fail(caught);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!view) return;
    try {
      const next = await api.archive(view.record.id);
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ title: `${kind[0]!.toUpperCase()}${kind.slice(1)} archived`, description: "It will not appear on the website after the next publish." });
    } catch (caught) {
      fail(caught);
    }
  };

  const reopen = async () => {
    if (!view) return;
    try {
      const next = await api.update(view.record.id, view.revision, { status: "draft" });
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      fail(caught);
    }
  };

  /* A transition acts on the saved revision on screen. */
  const act = async (action: WorkflowAction) => {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const next = await api.act(view.record.id, action, view.revision);
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ ...ACTED[action], tone: "success" });
    } catch (caught) {
      fail(caught, action === "approve" ? "approved" : action === "submit" ? "submitted" : "changed");
    } finally {
      setActing(false);
    }
  };

  const schedule = async (input: ScheduleInput): Promise<string | null> => {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      const next = await api.schedule(view.record.id, view.revision, input);
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ title: "Scheduled", description: "It is published at that time — not before.", tone: "success" });
      return null;
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 400) return caught.details.map((d) => d.message).join("; ") || caught.message;
      fail(caught, "scheduled");
      return caught instanceof ApiRequestError ? caught.message : "It could not be scheduled. Try again.";
    } finally {
      setActing(false);
    }
  };

  const unschedule = async () => {
    if (!view) return;
    setActing(true);
    setProblem(null);
    try {
      const next = await api.unschedule(view.record.id, view.revision);
      setView(next);
      setDraft(structuredClone(next.record));
      toast({ title: "Unscheduled", description: "It stays approved." });
    } catch (caught) {
      fail(caught, "changed");
    } finally {
      setActing(false);
    }
  };

  return {
    status,
    view,
    draft,
    set: (c) => setDraft((d) => ({ ...d, ...c })),
    dirty,
    saving,
    errors,
    problem,
    save: () => save(false),
    reload,
    discard: () => {
      setDraft(structuredClone((view?.record ?? initial) as Partial<R>));
      setErrors(new Map());
      setProblem(null);
    },
    slugConfirm: {
      open: slugPending,
      confirm: () => {
        setSlugPending(false);
        void save(true);
      },
      cancel: () => setSlugPending(false),
    },
    archive,
    reopen,
    act,
    acting,
    schedule,
    unschedule,
  };
}

/* The record's status badge (M14: its live version included). */
export const statusBadge = (status: ContentStatus | undefined, live = false, schedule: ScheduleView | null = null) => workflowBadge(status, live, schedule);

/* Above the form: the archived banner and the problem alert. */
export function EditorNotices<R extends { status: ContentStatus }>({ editor, kind, canEdit }: { editor: EditorState<R>; kind: string; canEdit: boolean }) {
  const archived = editor.view?.record.status === "archived";
  return (
    <>
      {archived && (
        <Alert tone="warning" title={`This ${kind} is archived`} className={styles.notice}>
          It is not on the website. Reopen it as a draft to edit or publish it again.
          {canEdit && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={editor.reopen}>
                Reopen as draft
              </Button>
            </span>
          )}
        </Alert>
      )}
      {editor.problem && (
        <Alert tone={editor.problem.kind === "conflict" ? "warning" : "danger"} role="alert" className={styles.notice} title={editor.problem.kind === "conflict" ? "Changed elsewhere" : undefined}>
          {editor.problem.message}
          {editor.problem.kind === "conflict" && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={editor.reload}>
                Reload latest
              </Button>
              <span className={styles.muted}> Your unsaved edits will be discarded.</span>
            </span>
          )}
        </Alert>
      )}
    </>
  );
}

/* Below the form: the sticky save bar, and the archive and address dialogs. */
export function EditorSaveBar<R extends { status: ContentStatus }>({ editor, kind, canEdit, canArchive }: { editor: EditorState<R>; kind: string; canEdit: boolean; canArchive: boolean }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archived = editor.view?.record.status === "archived";
  return (
    <>
      {canEdit && !archived && (
        <div className={styles.saveBar} data-dirty={editor.dirty || undefined}>
          <span className={styles.saveState} aria-live="polite">
            {editor.saving ? "Saving…" : editor.dirty ? "Unsaved changes" : editor.view ? `Saved · last by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}` : "Not saved yet"}
          </span>
          <span className={styles.saveActions}>
            {editor.view && canArchive && (
              <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
            <Button variant="ghost" disabled={!editor.dirty || editor.saving} onClick={editor.discard}>
              Discard
            </Button>
            <Button variant="primary" loading={editor.saving} disabled={!editor.dirty && !editor.saving} onClick={editor.save}>
              {editor.view ? "Save" : `Create ${kind}`}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title={`Archive this ${kind}?`}
        description="Archived content will no longer appear on the public website."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setConfirmArchive(false);
                await editor.archive();
              }}
            >
              Archive
            </Button>
          </>
        }
      />
      <Dialog
        open={editor.slugConfirm.open}
        onClose={editor.slugConfirm.cancel}
        size="sm"
        title="Change the address?"
        description={`This ${kind} has been published at its current address. Links to the old address will stop working; it is kept on record for a future redirect.`}
        footer={
          <>
            <Button onClick={editor.slugConfirm.cancel}>Keep the address</Button>
            <Button variant="primary" onClick={editor.slugConfirm.confirm}>
              Change address
            </Button>
          </>
        }
      />
    </>
  );
}
