import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiRequestError } from "../api";
import { useCan } from "../auth";
import {
  Alert,
  Archive,
  ArrowDown,
  ArrowUp,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Eye,
  EyeOff,
  FormField,
  IconButton,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Plus,
  Spinner,
  Tabs,
  Textarea,
  Trash2,
  useToast,
  type IconComponent,
} from "../design-system";
import type { ContentStatus, ScheduleInput, ScheduleView, WorkflowAction } from "../content/client";
import { statusBadge } from "../content/editor";
import { ACTED, WorkflowControls, isLocked } from "../content/workflow";
import { MediaPicker } from "../media/MediaPicker";
import { publishApi, type PublishStatus } from "../settings/client";
import { PublishPanel } from "../pages/settings/PublishPanel";
import { errorsByBlock, newBlockId, type Block, type BlockInfo } from "./blocks";
import { Preview, type PreviewOptions } from "./Preview";
import contentStyles from "../content/content.module.css";
import styles from "./blocks.module.css";

/* A BLOCK PAGE editor — the homepage (M8), the About page (M9): one page
   per organization as an ordered list of blocks from the contract's
   registry. The list on one side: select, show/hide, Move up / Move down
   (keyboard reachable; focus follows the moved block), remove, add. The
   selected block's typed form on the other, beside a draft preview and
   the page's SEO and publishing. Saving sends the whole list with the
   revision it was based on. The page is reviewed as a WHOLE revision
   (M14): submitted, approved by an owner, then put live by the owner's
   next website publish; until then the website keeps its published
   version (or its own page). The API decides; this reflects it.

   Each page supplies its registry, its block forms, its preview rules and
   its words (BlockPageConfig). */

export interface BlockPageRecord<S extends Block> {
  status: ContentStatus;
  publishedAt?: string;
  sections: S[];
  seo?: { title?: string; description?: string; ogImageId?: string; noIndex?: boolean };
}

export interface BlockPageView<S extends Block> {
  record: BlockPageRecord<S> | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of the page is on the website. */
  live: boolean;
  /* M15: when the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

interface Draft<S extends Block> {
  sections: S[];
  seo?: BlockPageRecord<S>["seo"];
  status: BlockPageRecord<S>["status"];
}

export interface BlockPageConfig<S extends Block> {
  /* "Homepage", "About page" — the page's title; `noun` in sentences. */
  title: string;
  noun: string;
  icon: IconComponent;
  description: string;
  addDescription: string;
  api: {
    get: () => Promise<BlockPageView<S>>;
    create: (draft: Draft<S>) => Promise<BlockPageView<S>>;
    update: (revision: number, changes: Partial<Omit<Draft<S>, "seo">> & { seo?: Draft<S>["seo"] | null }) => Promise<BlockPageView<S>>;
    archive: () => Promise<BlockPageView<S>>;
    act: (action: WorkflowAction, revision: number) => Promise<BlockPageView<S>>;
    schedule: (revision: number, input: ScheduleInput) => Promise<BlockPageView<S>>;
    unschedule: (revision: number) => Promise<BlockPageView<S>>;
  };
  blocks: readonly BlockInfo[];
  newBlockData: (type: string) => unknown;
  summary: (block: S) => string;
  editor: (props: { section: S; onChange: (section: S) => void; errors: Map<string, string> | undefined; disabled: boolean }) => ReactNode;
  preview: Omit<PreviewOptions, "title" | "info">;
}

const EMPTY = { sections: [], status: "draft" as const };
const draftOf = <S extends Block>(view: BlockPageView<S>): Draft<S> =>
  view.record ? { sections: structuredClone(view.record.sections), ...(view.record.seo && { seo: structuredClone(view.record.seo) }), status: view.record.status } : structuredClone(EMPTY);

export function BlockPageEditor<S extends Block>({ config }: { config: BlockPageConfig<S> }) {
  const { title, noun, api } = config;
  const info = (type: string) => config.blocks.find((b) => b.type === type)!;
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<BlockPageView<S> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft<S>>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("section");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockErrors, setBlockErrors] = useState<Map<string, Map<string, string>>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string; list?: string[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setProblem(null);
    setBlockErrors(new Map());
    try {
      const v = await api.get();
      setView(v);
      const d = draftOf(v);
      setDraft(d);
      setSelected((s) => (s && d.sections.some((x) => x.id === s) ? s : (d.sections[0]?.id ?? null)));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [api]);
  useEffect(() => void load(), [load]);

  const saved = useMemo(() => (view ? draftOf(view) : (EMPTY as Draft<S>)), [view]);
  const changed = (["sections", "seo", "status"] as const).filter((k) => JSON.stringify(draft[k] ?? null) !== JSON.stringify(saved[k] ?? null));
  const dirty = changed.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loadFailed) return <PageContainer><EmptyState title={`The ${noun} could not be loaded`} description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!view) return <PageContainer><Spinner label={`Loading the ${noun}`} /></PageContainer>;

  const archived = view.record?.status === "archived";
  const readOnly = !canEdit || isLocked(view.record?.status);
  const sections = draft.sections;
  const current = sections.find((s) => s.id === selected) ?? null;
  const setSections = (next: S[]) => setDraft((d) => ({ ...d, sections: next }));
  const updateSection = (section: S) => setSections(sections.map((s) => (s.id === section.id ? section : s)));

  const move = (i: number, by: number, action: "up" | "down") => {
    const next = [...sections];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s!);
    setSections(next);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-block-id="${s!.id}"] [data-move="${action}"]`)?.focus());
  };
  const remove = (section: S) => {
    const next = sections.filter((s) => s.id !== section.id);
    setSections(next);
    if (selected === section.id) setSelected(next[0]?.id ?? null);
    toast({ title: `“${info(section.type).label}” removed`, description: "Discard brings it back until you save." });
  };
  const add = (type: string) => {
    const section = { id: newBlockId(type), type, enabled: true, version: 1, data: config.newBlockData(type) } as S;
    setSections(info(type).first ? [section, ...sections] : [...sections, section]);
    setSelected(section.id);
    setTab("section");
    setAdding(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-block-id="${section.id}"] [data-select]`)?.focus());
  };

  async function save() {
    if (!view) return;
    setSaving(true);
    setProblem(null);
    setBlockErrors(new Map());
    try {
      const next = view.record
        ? await api.update(view.revision, Object.fromEntries(changed.map((k) => [k, draft[k] ?? null])))
        : await api.create({ sections: draft.sections, ...(draft.seo && { seo: draft.seo }) } as Draft<S>);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: view.record ? "Saved" : `${title} created`, tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        const { blocks, general } = errorsByBlock(caught.details, draft.sections);
        setBlockErrors(blocks);
        const first = draft.sections.find((s) => blocks.has(s.id));
        if (first) {
          setSelected(first.id);
          setTab("section");
        }
        setProblem({
          kind: "invalid",
          message: blocks.size ? `${blocks.size} block${blocks.size === 1 ? " needs" : "s need"} attention before this can be saved.` : "Some fields need attention before this can be saved.",
          list: general.map((g) => (g.path.startsWith("media.") ? `An image is not available: ${g.message}` : `${g.path}: ${g.message}`)),
        });
      } else setProblem({ kind: "error", message: `The ${noun} could not be saved. Try again.` });
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
      const next = await api.schedule(view.revision, input);
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
      const next = await api.unschedule(view.revision);
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
    setBlockErrors(new Map());
    try {
      const next = await api.act(action, view.revision);
      setView(next);
      setDraft(draftOf(next));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        const { blocks, general } = errorsByBlock(caught.details, draft.sections);
        setBlockErrors(blocks);
        const first = draft.sections.find((s) => blocks.has(s.id));
        if (first) {
          setSelected(first.id);
          setTab("section");
        }
        setProblem({
          kind: "invalid",
          message: blocks.size ? `${blocks.size} block${blocks.size === 1 ? " needs" : "s need"} attention before this can be ${action === "approve" ? "approved" : "submitted"}.` : caught.message === "Request validation failed." ? `The ${noun} can't be ${action === "approve" ? "approved" : "submitted"} yet.` : caught.message,
          list: general.map((g) => (g.path.startsWith("media.") ? `An image is not available: ${g.message}` : `${g.path}: ${g.message}`)),
        });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: `The ${noun} could not be changed. Try again.` });
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      const next = await api.archive();
      setView(next);
      setDraft(draftOf(next));
      toast({ title: `${title} archived`, description: `After the next publish, the website shows its own ${noun}.` });
      publishApi.status().then(setPublish, () => {});
    } catch {
      toast({ title: `The ${noun} could not be archived`, tone: "danger" });
    }
  }

  const seo = draft.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Draft<S>["seo"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...seo, ...changes }).filter(([, v]) => v !== undefined && v !== ""));
    setDraft((d) => ({ ...d, seo: Object.keys(next).length ? next : undefined }));
  };
  const placed = new Set(sections.map((s) => s.type));

  return (
    <PageContainer>
      <PageHeader
        title={title}
        eyebrow={view.record ? statusBadge(view.record.status, view.live, view.schedule) : undefined}
        description={
          view.record && view.updatedAt
            ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.${publish?.active ? ` The website is on published version ${publish.active.version}.` : ""}`
            : config.description
        }
        actions={
          !readOnly ? (
            <Button leadingIcon={<Plus />} onClick={() => setAdding(true)}>
              Add section
            </Button>
          ) : undefined
        }
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {archived && (
        <Alert tone="warning" title={`This ${noun} is archived`} className={contentStyles.notice}>
          The website shows its own {noun} after the next publish.
          {canEdit && (
            <span className={contentStyles.inlineAction}>
              <Button size="sm" onClick={() => setDraft((d) => ({ ...d, status: "draft" }))} disabled={draft.status === "draft"}>
                Reopen as draft
              </Button>
              {draft.status === "draft" && <span className={contentStyles.muted}> Save to reopen it.</span>}
            </span>
          )}
        </Alert>
      )}
      {problem && (
        <Alert tone={problem.kind === "conflict" ? "warning" : "danger"} role="alert" className={contentStyles.notice} title={problem.kind === "conflict" ? "Changed elsewhere" : undefined}>
          {problem.message}
          {problem.list && problem.list.length > 0 && (
            <ul>
              {problem.list.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
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

      {view.record && !archived && (
        <Panel title="Review and approval" as="h2" className={contentStyles.notice}>
          <WorkflowControls status={view.record.status} live={view.live} noun={noun} canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={view.record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
        </Panel>
      )}

      <div className={styles.layout}>
        <div className={styles.listColumn}>
          <Panel title="Sections" as="h2" description={`${sections.length} block${sections.length === 1 ? "" : "s"}, top to bottom. Hidden blocks stay in the draft but are not published.`}>
            {sections.length === 0 ? (
              <EmptyState icon={config.icon} title="No sections yet" description={`Add the blocks the ${noun} should show.`} actions={!readOnly ? <Button leadingIcon={<Plus />} onClick={() => setAdding(true)}>Add section</Button> : undefined} />
            ) : (
              <ol className={styles.blocks} aria-label={`${title} sections`}>
                {sections.map((s, i) => {
                  const b = info(s.type);
                  const invalid = blockErrors.has(s.id);
                  return (
                    <li key={s.id} className={styles.block} data-block-id={s.id} data-selected={selected === s.id || undefined} data-disabled={!s.enabled || undefined} data-invalid={invalid || undefined}>
                      <div className={styles.blockMain}>
                        <button type="button" className={styles.blockSelect} data-select aria-current={selected === s.id ? "true" : undefined} onClick={() => { setSelected(s.id); setTab("section"); }}>
                          <span className={styles.blockTitle}>
                            {b.label}
                            {!s.enabled && <Badge>Hidden</Badge>}
                            {invalid && <Badge tone="danger">Needs attention</Badge>}
                          </span>
                          <span className={styles.blockSummary}>{config.summary(s)}</span>
                        </button>
                      </div>
                      <div className={styles.blockActions}>
                        <IconButton size="sm" label={s.enabled ? `Hide “${b.label}”` : `Show “${b.label}”`} aria-pressed={!s.enabled} icon={s.enabled ? <Eye /> : <EyeOff />} disabled={readOnly} onClick={() => updateSection({ ...s, enabled: !s.enabled })} />
                        <IconButton size="sm" label={`Move “${b.label}” up`} icon={<ArrowUp />} data-move="up" disabled={readOnly || i === 0 || (i === 1 && Boolean(info(sections[0]!.type).first)) || Boolean(b.first)} onClick={() => move(i, -1, "up")} />
                        <IconButton size="sm" label={`Move “${b.label}” down`} icon={<ArrowDown />} data-move="down" disabled={readOnly || i === sections.length - 1 || Boolean(b.first)} onClick={() => move(i, 1, "down")} />
                        <IconButton size="sm" label={`Remove “${b.label}”`} icon={<Trash2 />} disabled={readOnly} onClick={() => remove(s)} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className={styles.editColumn}>
          <Tabs
            label={`${title} editor`}
            value={tab}
            onValueChange={setTab}
            items={[
              {
                id: "section",
                label: "Edit section",
                content: current ? (
                  <Panel title={info(current.type).label} as="h2" description={info(current.type).description}>
                    {config.editor({ section: current, onChange: updateSection, errors: blockErrors.get(current.id), disabled: readOnly })}
                  </Panel>
                ) : (
                  <Panel title="No section selected" as="h2">
                    <p className={styles.help}>Choose a section from the list, or add one.</p>
                  </Panel>
                ),
              },
              { id: "preview", label: "Preview", content: <Preview sections={sections} options={{ ...config.preview, title, info }} /> },
              {
                id: "page",
                label: "SEO and publishing",
                content: (
                  <div className={styles.fields}>
                    <Panel title="SEO" as="h2" description="Leave empty to use the site's own title and description.">
                      <div className={styles.fields}>
                        <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly}>
                          <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
                        </FormField>
                        <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly}>
                          <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
                        </FormField>
                        <MediaPicker label="Social image" helper={`Shown when the ${noun} is shared.`} value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} />
                      </div>
                    </Panel>
                    <Panel title="Publishing" as="h2">
                      <div className={styles.fields}>
                        <p className={styles.help}>
                          {archived
                            ? "Archived. Reopen it as a draft (above) to change it."
                            : `The ${noun} is reviewed as a whole: submit it for review (top of the page); once an owner approves it, the next website publish puts it live.`}
                        </p>
                        {view.record && canArchive && !archived && (
                          <div>
                            <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                              Archive {noun}
                            </Button>
                          </div>
                        )}
                        {!canEdit && <Alert tone="info">You can view the {noun} but not change it.</Alert>}
                      </div>
                    </Panel>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      {canEdit && (
        <div className={contentStyles.saveBar} data-dirty={dirty || undefined}>
          <span className={contentStyles.saveState} aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : view.record ? `Saved · last by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}` : "Not saved yet"}
          </span>
          <span className={contentStyles.saveActions}>
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => {
                const d = draftOf(view);
                setDraft(d);
                setBlockErrors(new Map());
                setProblem(null);
                if (!d.sections.some((s) => s.id === selected)) setSelected(d.sections[0]?.id ?? null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={!dirty && !saving} onClick={save}>
              {view.record ? "Save" : `Create ${noun}`}
            </Button>
          </span>
        </div>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a section" description={config.addDescription} size="md">
        <ul className={styles.addList}>
          {config.blocks.map((b) => {
            const taken = b.single && placed.has(b.type);
            return (
              <li key={b.type}>
                <button type="button" className={styles.addOption} aria-disabled={taken || undefined} onClick={() => !taken && add(b.type)}>
                  <strong>{b.label}</strong>
                  <span className={styles.help}>{taken ? `Already on the ${noun} — there is one of these.` : b.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title={`Archive the ${noun}?`}
        description={`After the next publish, the website shows its own ${noun} again. Nothing is deleted.`}
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
