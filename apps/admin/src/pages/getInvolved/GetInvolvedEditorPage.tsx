import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FormField, HandHelping, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList } from "../../blocks/fields";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { publishApi, type PublishStatus } from "../../settings/client";
import { getInvolvedApi, type GetInvolvedView } from "../../getInvolved/client";
import {
  CTA_OPTIONS,
  HUB_PARTS,
  PAGE_IDS,
  PAGE_INFO,
  PATH_PARTS,
  anchorOf,
  changedParts,
  followsHeading,
  hubApprovalGaps,
  hubDraftOf,
  hubPayloadOf,
  hubProblems,
  isPageId,
  pathApprovalGaps,
  pathDraftOf,
  pathPayloadOf,
  pathProblems,
  type Cta,
  type EditorSection,
  type HubDraft,
  type HubPayload,
  type PageKey,
  type PathDraft,
} from "../../getInvolved/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import blockStyles from "../../blocks/blocks.module.css";

/* /get-involved/:id — one of the five Get Involved pages (M20): the hub or
   one way to take part. Its address, and a path's title, button label,
   icon, images and form, are the website's and fixed. Plain paragraphs and
   bullet lists only. Every word is Rising Beyond Borders' — nothing is
   filled in here, and an empty page says so. What a published page leaves
   out keeps the website's own words. Saves send whole parts with the
   revision they were based on; a stale one offers "Reload latest". */

export default function GetInvolvedEditorPage({ params }: PageProps) {
  const id = params.id ?? "";
  if (!isPageId(id))
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={HandHelping} title="There is no such Get Involved page" description={`The pages are: ${PAGE_IDS.map((p) => PAGE_INFO[p].title).join(", ")}.`} actions={<Button onClick={() => navigate("/get-involved")}>All Get Involved pages</Button>} />
      </PageContainer>
    );
  return <Editor key={id} id={id} />;
}

type Draft = HubDraft | PathDraft;
const draftOf = (id: PageKey, record: GetInvolvedView["record"]): Draft => (id === "hub" ? hubDraftOf(record as HubPayload | null) : pathDraftOf(record as never));
const payloadOf = (id: PageKey, d: Draft) => (id === "hub" ? hubPayloadOf(d as HubDraft) : pathPayloadOf(d as PathDraft));

function Editor({ id }: { id: PageKey }) {
  const info = PAGE_INFO[id];
  const isHub = id === "hub";
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<GetInvolvedView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(id, null));
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);

  const show = useCallback(
    (next: GetInvolvedView) => {
      setView(next);
      setDraft(draftOf(id, next.record));
    },
    [id]
  );
  const load = useCallback(async () => {
    setProblem(null);
    setErrors(new Map());
    try {
      show(await getInvolvedApi.get(id));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [id, show]);
  useEffect(() => void load(), [load]);

  const saved = useMemo(() => draftOf(id, view?.record ?? null), [id, view]);
  const parts = isHub ? HUB_PARTS : PATH_PARTS;
  const payload = payloadOf(id, draft);
  const changes = changedParts(parts, payload, payloadOf(id, saved));
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loadFailed)
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={HandHelping} title={`The ${info.label} could not be loaded`} description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );
  if (!view) return <PageContainer width="narrow"><Spinner label={`Loading the ${info.label}`} /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status) || archived;
  const err = (path: string) => errors.get(path);
  const gaps = isHub ? hubApprovalGaps(payload as HubPayload) : pathApprovalGaps(payload as ReturnType<typeof pathPayloadOf>);
  const empty = !record || Object.keys(payload).filter((k) => k !== "sections").length === 0 && (isHub || (payload as { sections: unknown[] }).sections.length === 0);

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
    const local = isHub ? hubProblems(draft as HubDraft) : pathProblems(draft as PathDraft);
    if (local.size) {
      setErrors(local);
      setProblem({ kind: "invalid", message: "Some fields need attention before this can be saved." });
      return;
    }
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const body = view.record ? changes : Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
      show(await getInvolvedApi.update(id, view.revision, body));
      toast({ title: view.record ? "Saved" : `${info.label} created`, tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, `The ${info.label} could not be saved. Try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function act(action: WorkflowAction) {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await getInvolvedApi.act(id)(action, view.revision));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, `The ${info.label} could not be changed. Try again.`);
    } finally {
      setActing(false);
    }
  }

  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      show(await getInvolvedApi.schedule(id)(view.revision, input));
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
      show(await getInvolvedApi.unschedule(id)(view.revision));
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
      show(await getInvolvedApi.archive(id));
      toast({ title: `${info.label} archived`, description: "The website keeps its own words for it after the next publish." });
    } catch {
      setProblem({ kind: "error", message: `The ${info.label} could not be archived. Try again.` });
    }
  }

  async function reopen() {
    if (!view) return;
    try {
      show(await getInvolvedApi.update(id, view.revision, { status: "draft" }));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    }
  }

  const fields = { err, readOnly };
  return (
    <PageContainer width="narrow">
      <PageHeader
        title={info.label}
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : `The website's ${info.label} (${info.route}). Until it is published here, the website keeps its own words for it.`}
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {empty && !archived && (
        <Alert tone="info" title="This page has no words yet" className={contentStyles.notice} data-testid="gi-empty">
          Its words must come from Rising Beyond Borders. Nothing is written for you here, and until this page is published the website keeps the words it shows today.
        </Alert>
      )}
      {archived && (
        <Alert tone="warning" title={`This ${info.label} is archived`} className={contentStyles.notice}>
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
        {isHub ? (
          <HubFields draft={draft as HubDraft} set={(c) => setDraft((d) => ({ ...(d as HubDraft), ...c }))} {...fields} />
        ) : (
          <PathFields id={id} draft={draft as PathDraft} set={(c) => setDraft((d) => ({ ...(d as PathDraft), ...c }))} savedIds={((record as { sections?: { id: string }[] } | null)?.sections ?? []).map((s) => s.id)} {...fields} />
        )}
        <Panel title="Publishing" as="h2">
          <div className={contentStyles.fields}>
            {record && record.status !== "archived" && record.status !== "published" && gaps.length > 0 && (
              <Alert tone="info" data-testid="gi-gaps">
                Before it can be approved it needs {gaps.join(" and ")}.
              </Alert>
            )}
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun={info.label} canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={contentStyles.muted}>Save it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view the {info.label} but not change it.</Alert>}
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
                setDraft(draftOf(id, view.record));
                setErrors(new Map());
                setProblem(null);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={(record ? !dirty : false) || saving || isLocked(record?.status)} onClick={save}>
              {record ? "Save" : `Create ${info.label}`}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title={`Archive the ${info.label}?`}
        description="Archived, it leaves the website at the next publish, and the website shows its own words for this page again."
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

type Fields = { err: (path: string) => string | undefined; readOnly: boolean };

function PathFields({ id, draft, set, savedIds, err, readOnly }: Fields & { id: Exclude<PageKey, "hub">; draft: PathDraft; set: (c: Partial<PathDraft>) => void; savedIds: string[] }) {
  const info = PAGE_INFO[id];
  const sectionEditor = (section: EditorSection, setOne: (s: EditorSection) => void, i: number) => (
    <div className={blockStyles.fields}>
      <FormField label="Heading" required disabled={readOnly} error={err(`sections.${i}.heading`)}>
        <Input maxLength={160} value={section.heading} onChange={(e) => setOne({ ...section, heading: e.target.value, id: followsHeading(section, savedIds) ? anchorOf(e.target.value) : section.id })} />
      </FormField>
      <FormField label="Anchor" required helper={`The section's address: ${info.route}#${section.id || "…"}. Keep it unchanged once published. “inquiry” is the form's.`} disabled={readOnly} error={err(`sections.${i}.id`)}>
        <Input maxLength={60} value={section.id} onChange={(e) => setOne({ ...section, id: e.target.value.trim().toLowerCase() })} />
      </FormField>
      <FormField label="Paragraphs" helper="Plain text. Separate paragraphs with a blank line." disabled={readOnly} error={err(`sections.${i}.body`) ?? err(`sections.${i}.body.0`)}>
        <Textarea rows={5} value={section.bodyText} onChange={(e) => setOne({ ...section, bodyText: e.target.value })} />
      </FormField>
      <FormField label="Bullet list" helper="Optional. One item per line." disabled={readOnly} error={err(`sections.${i}.items`) ?? err(`sections.${i}.items.0`)}>
        <Textarea rows={4} value={section.itemsText} onChange={(e) => setOne({ ...section, itemsText: e.target.value })} />
      </FormField>
    </div>
  );
  return (
    <>
      <Panel title="Path" as="h2" description={`“${info.title}” at ${info.route}. Its title, button label, address, icon, images and form are the website's — fixed.`}>
        <div className={contentStyles.fields}>
          <FormField label="Short description" helper="Its line on the path cards across the site and under the page title. Up to 200 characters. Required to approve." disabled={readOnly} error={err("shortDescription")}>
            <Textarea rows={2} maxLength={200} value={draft.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
          </FormField>
          <FormField label="Line on the Get Involved page" helper="Its line under “What each path involves” on /get-involved. Up to 300 characters. Leave empty to keep the website's." disabled={readOnly} error={err("hubNote")}>
            <Textarea rows={2} maxLength={300} value={draft.hubNote} onChange={(e) => set({ hubNote: e.target.value })} />
          </FormField>
        </div>
      </Panel>
      <Panel title="Sections" as="h2" description="In the order the page shows them. At least one is required to approve.">
        <ItemList
          label="Sections"
          items={draft.sections}
          max={12}
          disabled={readOnly}
          error={err("sections")}
          itemLabel={(i) => `Section ${i + 1}${draft.sections[i]?.heading ? ` — ${draft.sections[i]!.heading}` : ""}`}
          addLabel="Add a section"
          onChange={(sections) => set({ sections })}
          make={() => ({ id: "", heading: "", bodyText: "", itemsText: "" })}
          render={sectionEditor}
        />
      </Panel>
      <Panel title="Questions and answers" as="h2" description="Optional. Shown on the page's dark band once there is at least one.">
        <div className={contentStyles.fields}>
          <Checkbox label="Include questions and answers" checked={draft.faqOn} disabled={readOnly} onChange={(e) => set({ faqOn: e.target.checked, ...(e.target.checked && !draft.faqItems.length && { faqItems: [{ question: "", answer: "" }] }) })} />
          {draft.faqOn && (
            <>
              <FormField label="Heading" required disabled={readOnly} error={err("faq.heading")}>
                <Input maxLength={160} value={draft.faqHeading} onChange={(e) => set({ faqHeading: e.target.value })} />
              </FormField>
              <ItemList
                label="Questions"
                items={draft.faqItems}
                max={20}
                disabled={readOnly}
                error={err("faq.items")}
                itemLabel={(i) => `Question ${i + 1}`}
                addLabel="Add a question"
                onChange={(faqItems) => set({ faqItems })}
                make={() => ({ question: "", answer: "" })}
                render={(item, setItem, i) => (
                  <div className={blockStyles.fields}>
                    <FormField label={`Question ${i + 1}`} required disabled={readOnly} error={err(`faq.items.${i}.question`)}>
                      <Input maxLength={300} value={item.question} onChange={(e) => setItem({ ...item, question: e.target.value })} />
                    </FormField>
                    <FormField label={`Answer ${i + 1}`} required disabled={readOnly} error={err(`faq.items.${i}.answer`)}>
                      <Textarea rows={3} maxLength={2000} value={item.answer} onChange={(e) => setItem({ ...item, answer: e.target.value })} />
                    </FormField>
                  </div>
                )}
              />
            </>
          )}
        </div>
      </Panel>
      <Panel title="SEO" as="h2" description="Leave empty to keep the website's own description for this page.">
        <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description") ?? err("seo")}>
          <Textarea rows={2} maxLength={200} value={draft.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} />
        </FormField>
      </Panel>
    </>
  );
}

function CtaFields({ name, legend, value, onChange, err, readOnly }: Fields & { name: "primary" | "secondary"; legend: string; value: Cta; onChange: (c: Cta) => void }) {
  return (
    <fieldset className={blockStyles.group}>
      <legend className={blockStyles.legend}>{legend}</legend>
      <div className={blockStyles.row}>
        <FormField label="Button text" required disabled={readOnly} error={err(`closing.${name}.label`)}>
          <Input maxLength={60} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        </FormField>
        <FormField label="Leads to" required helper="One of the website's sections — never a typed-in address." disabled={readOnly} error={err(`closing.${name}.target`)}>
          <Select value={value.target} placeholder="Choose a section" options={CTA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onChange={(e) => onChange({ ...value, target: e.target.value as Cta["target"] })} />
        </FormField>
      </div>
    </fieldset>
  );
}

function HubFields({ draft, set, err, readOnly }: Fields & { draft: HubDraft; set: (c: Partial<HubDraft>) => void }) {
  const fields = { err, readOnly };
  return (
    <>
      <Panel title="Page header" as="h2" description="Address: /get-involved — fixed. Both are required to approve.">
        <div className={contentStyles.fields}>
          <FormField label="Heading" disabled={readOnly} error={err("heading")}>
            <Input maxLength={120} value={draft.heading} onChange={(e) => set({ heading: e.target.value })} />
          </FormField>
          <FormField label="Introduction" helper="Up to 400 characters." disabled={readOnly} error={err("intro")}>
            <Textarea rows={3} maxLength={400} value={draft.intro} onChange={(e) => set({ intro: e.target.value })} />
          </FormField>
        </div>
      </Panel>
      <Panel title="The four paths" as="h2" description="The headings above the path cards and the path list. The paths themselves — their names, lines, icons and links — come from each path's own page here. Leave a pair empty to keep the website's words.">
        <div className={contentStyles.fields}>
          <fieldset className={blockStyles.group}>
            <legend className={blockStyles.legend}>Path cards</legend>
            <div className={blockStyles.row}>
              <FormField label="Kicker" disabled={readOnly} error={err("ways.kicker")}>
                <Input maxLength={60} value={draft.waysKicker} onChange={(e) => set({ waysKicker: e.target.value })} />
              </FormField>
              <FormField label="Heading" disabled={readOnly} error={err("ways.heading")}>
                <Input maxLength={160} value={draft.waysHeading} onChange={(e) => set({ waysHeading: e.target.value })} />
              </FormField>
            </div>
          </fieldset>
          <fieldset className={blockStyles.group}>
            <legend className={blockStyles.legend}>“What each path involves”</legend>
            <div className={blockStyles.row}>
              <FormField label="Kicker" disabled={readOnly} error={err("choose.kicker")}>
                <Input maxLength={60} value={draft.chooseKicker} onChange={(e) => set({ chooseKicker: e.target.value })} />
              </FormField>
              <FormField label="Heading" disabled={readOnly} error={err("choose.heading")}>
                <Input maxLength={160} value={draft.chooseHeading} onChange={(e) => set({ chooseHeading: e.target.value })} />
              </FormField>
            </div>
          </fieldset>
        </div>
      </Panel>
      <Panel title="Why get involved" as="h2" description="Without your own text, the page shows the organization's mission statement, as today.">
        <div className={contentStyles.fields}>
          <Checkbox label="Use our own text" checked={draft.whyOn} disabled={readOnly} onChange={(e) => set({ whyOn: e.target.checked })} />
          {draft.whyOn && (
            <>
              <FormField label="Heading" required disabled={readOnly} error={err("why.heading")}>
                <Input maxLength={160} value={draft.whyHeading} onChange={(e) => set({ whyHeading: e.target.value })} />
              </FormField>
              <FormField label="Paragraphs" required helper="Plain text. Separate paragraphs with a blank line." disabled={readOnly} error={err("why.body") ?? err("why.body.0")}>
                <Textarea rows={5} value={draft.whyText} onChange={(e) => set({ whyText: e.target.value })} />
              </FormField>
            </>
          )}
        </div>
      </Panel>
      <Panel title="Closing" as="h2" description="The last band of the page. Without your own, the website keeps its closing.">
        <div className={contentStyles.fields}>
          <Checkbox label="Use our own closing" checked={draft.closingOn} disabled={readOnly} onChange={(e) => set({ closingOn: e.target.checked })} />
          {draft.closingOn && (
            <>
              <FormField label="Heading" required disabled={readOnly} error={err("closing.heading")}>
                <Input maxLength={160} value={draft.closingHeading} onChange={(e) => set({ closingHeading: e.target.value })} />
              </FormField>
              <CtaFields name="primary" legend="Main button" value={draft.primary} onChange={(primary) => set({ primary })} {...fields} />
              <Checkbox label="Add a second button" checked={draft.secondaryOn} disabled={readOnly} onChange={(e) => set({ secondaryOn: e.target.checked })} />
              {draft.secondaryOn && <CtaFields name="secondary" legend="Second button" value={draft.secondary} onChange={(secondary) => set({ secondary })} {...fields} />}
            </>
          )}
        </div>
      </Panel>
      <Alert tone="info">The Work and Impact teasers, the questions panel and the path cards' names stay the website's.</Alert>
    </>
  );
}
