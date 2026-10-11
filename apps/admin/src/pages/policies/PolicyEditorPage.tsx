import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Archive, Button, Checkbox, Dialog, EmptyState, FileText, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, useToast } from "../../design-system";
import { statusBadge } from "../../content/editor";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList } from "../../blocks/fields";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { publishApi, type PublishStatus } from "../../settings/client";
import { policiesApi, type ContactMethodOption, type PolicyView } from "../../policies/client";
import { POLICY_IDS, POLICY_INFO, anchorOf, approvalGaps, changedParts, draftOf, draftProblems, emptySection, followsHeading, isPolicyId, payloadOf, type EditorDraft, type EditorSection, type PolicyKey } from "../../policies/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import blockStyles from "../../blocks/blocks.module.css";
import styles from "./policies.module.css";

/* /policies/:id — one of the website's three policies (M19). Its id and
   address are fixed. Plain paragraphs and bullet lists only: no rich text,
   no HTML. Every word and both dates are Rising Beyond Borders' — nothing
   is filled in here, and an empty policy says so. Saves send whole parts
   with the revision they were based on; a stale one offers "Reload
   latest". Until it is PUBLISHED (and an owner publishes the site), the
   website keeps its own page for the policy. */

export default function PolicyEditorPage({ params }: PageProps) {
  const id = params.id ?? "";
  if (!isPolicyId(id))
    return (
      <PageContainer width="narrow">
        <EmptyState bordered icon={FileText} title="There is no such policy" description={`The website has three policies: ${POLICY_IDS.map((p) => POLICY_INFO[p].label).join(", ")}.`} actions={<Button onClick={() => navigate("/policies")}>All policies</Button>} />
      </PageContainer>
    );
  return <PolicyEditor key={id} id={id} />;
}

function PolicyEditor({ id }: { id: PolicyKey }) {
  const info = POLICY_INFO[id];
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<PolicyView | null>(null);
  const [methods, setMethods] = useState<ContactMethodOption[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<EditorDraft>(() => draftOf(id, null));
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);

  const show = useCallback(
    (next: PolicyView) => {
      setView(next);
      setDraft(draftOf(id, next.record));
    },
    [id]
  );
  const load = useCallback(async () => {
    setProblem(null);
    setErrors(new Map());
    try {
      const [v, list] = await Promise.all([policiesApi.get(id), policiesApi.list()]);
      show(v);
      setMethods(list.contactMethods);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, [id, show]);
  useEffect(() => void load(), [load]);

  const saved = useMemo(() => draftOf(id, view?.record ?? null), [id, view]);
  const changes = changedParts(draft, saved);
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
        <EmptyState bordered icon={FileText} title={`The ${info.label} could not be loaded`} description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );
  if (!view) return <PageContainer width="narrow"><Spinner label={`Loading the ${info.label}`} /></PageContainer>;

  const record = view.record;
  const archived = record?.status === "archived";
  const readOnly = !canEdit || isLocked(record?.status) || archived;
  const err = (path: string) => errors.get(path);
  const set = (changes: Partial<EditorDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const savedIds = (record?.sections ?? []).map((s) => s.id);
  const payload = payloadOf(draft);
  const gaps = approvalGaps(payload);
  const empty = !record || (record.sections.length === 0 && record.intro.length === 0);
  const contactMissing = Boolean(draft.contactReference) && !methods.some((m) => m.id === draft.contactReference);

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
    const local = draftProblems(draft);
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
      const next = await policiesApi.update(id, view.revision, body);
      show(next);
      toast({ title: view.record ? "Saved" : `${info.label} created`, tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, `The ${info.label} could not be saved. Try again.`);
    } finally {
      setSaving(false);
    }
  }

  /* A workflow transition, on the saved revision. */
  async function act(action: WorkflowAction) {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      show(await policiesApi.act(id)(action, view.revision));
      toast({ ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      failed(caught, `The ${info.label} could not be changed. Try again.`);
    } finally {
      setActing(false);
    }
  }

  /* Owners: queue the approved revision for a website publication, or
     drop that. A 400 is the dialog's to show. */
  async function scheduleIt(input: ScheduleInput): Promise<string | null> {
    if (!view) return null;
    setActing(true);
    setProblem(null);
    try {
      show(await policiesApi.schedule(id)(view.revision, input));
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
      show(await policiesApi.unschedule(id)(view.revision));
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
      show(await policiesApi.archive(id));
      toast({ title: `${info.label} archived`, description: "The website keeps its own page for it after the next publish." });
    } catch {
      setProblem({ kind: "error", message: `The ${info.label} could not be archived. Try again.` });
    }
  }

  async function reopen() {
    if (!view) return;
    try {
      show(await policiesApi.update(id, view.revision, { status: "draft" }));
      toast({ title: "Reopened as a draft" });
    } catch (caught) {
      setProblem({ kind: caught instanceof ApiRequestError && caught.status === 409 ? "conflict" : "error", message: caught instanceof Error ? caught.message : "Try again." });
    }
  }

  const setSection = (sections: EditorSection[]) => set({ sections });
  const sectionEditor = (section: EditorSection, setOne: (s: EditorSection) => void, i: number) => (
    <div className={blockStyles.fields}>
      <FormField label="Heading" required disabled={readOnly} error={err(`sections.${i}.heading`)}>
        <Input
          maxLength={160}
          value={section.heading}
          onChange={(e) => {
            const heading = e.target.value;
            setOne({ ...section, heading, id: followsHeading(section, savedIds) ? anchorOf(heading) : section.id });
          }}
        />
      </FormField>
      <FormField label="Anchor" required helper={`The section's address: ${info.route}#${section.id || "…"}. Keep it unchanged once published, so links to it keep working.`} disabled={readOnly} error={err(`sections.${i}.id`)}>
        <Input maxLength={60} value={section.id} onChange={(e) => setOne({ ...section, id: e.target.value.trim().toLowerCase() })} />
      </FormField>
      <FormField label="Paragraphs" helper="Plain text. Separate paragraphs with a blank line." disabled={readOnly} error={err(`sections.${i}.body`) ?? err(`sections.${i}.body.0`)}>
        <Textarea rows={6} value={section.bodyText} onChange={(e) => setOne({ ...section, bodyText: e.target.value })} />
      </FormField>
      <FormField label="Bullet list" helper="Optional. One item per line." disabled={readOnly} error={err(`sections.${i}.items`) ?? err(`sections.${i}.items.0`)}>
        <Textarea rows={4} value={section.itemsText} onChange={(e) => setOne({ ...section, itemsText: e.target.value })} />
      </FormField>
    </div>
  );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={info.label}
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : `The website's ${info.label} (${info.route}). Until it is published here, the website keeps its own page for it.`}
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
      )}
      {empty && !archived && (
        <Alert tone="info" title="This policy has no text yet" className={contentStyles.notice} data-testid="policy-empty">
          Its wording, its sections and both dates must come from Rising Beyond Borders, approved by its counsel. Nothing is written for you here — paste the approved text as supplied.
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
        <Panel title="Policy" as="h2" description={`Address: ${info.route} — fixed. The policy and its address cannot be changed here.`}>
          <div className={contentStyles.fields}>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </FormField>
            <div className={blockStyles.row}>
              <FormField label="Effective date" helper="Rising Beyond Borders' date — never the day it is published. Required to approve." disabled={readOnly} error={err("effectiveDate")}>
                <Input type="date" value={draft.effectiveDate} onChange={(e) => set({ effectiveDate: e.target.value })} />
              </FormField>
              <FormField label="Last updated" helper="Rising Beyond Borders' date. Required to approve." disabled={readOnly} error={err("lastUpdated")}>
                <Input type="date" value={draft.lastUpdated} onChange={(e) => set({ lastUpdated: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Introduction" helper="Optional lead paragraphs, plain text. Separate paragraphs with a blank line." disabled={readOnly} error={err("intro") ?? err("intro.0")}>
              <Textarea rows={4} value={draft.introText} onChange={(e) => set({ introText: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Sections" as="h2" description="In the order the page shows them. Each has a heading, paragraphs and, if needed, a bullet list. At least one is required to approve.">
          <ItemList
            label="Sections"
            items={draft.sections}
            max={40}
            disabled={readOnly}
            error={err("sections")}
            itemLabel={(i) => `Section ${i + 1}${draft.sections[i]?.heading ? ` — ${draft.sections[i]!.heading}` : ""}`}
            addLabel="Add a section"
            onChange={setSection}
            make={emptySection}
            render={sectionEditor}
          />
        </Panel>
        <Panel title="Contact and related policies" as="h2">
          <div className={contentStyles.fields}>
            <FormField
              label="Contact for questions"
              helper={methods.length ? "Optional. One of the contact methods in Settings — the page shows it while it is in the published settings." : "Optional. There are no contact methods in Settings yet; add one there first."}
              disabled={readOnly || (!methods.length && !draft.contactReference)}
              error={err("contactReference") ?? (contactMissing ? "This contact method is no longer in Settings. Choose another, or none." : undefined)}
            >
              <Select
                value={draft.contactReference}
                onChange={(e) => set({ contactReference: e.target.value })}
                options={[{ value: "", label: "No contact" }, ...methods.map((m) => ({ value: m.id, label: `${m.label} — ${m.value}` })), ...(contactMissing ? [{ value: draft.contactReference, label: "(no longer in Settings)" }] : [])]}
              />
            </FormField>
            <fieldset className={blockStyles.group}>
              <legend className={blockStyles.legend}>Related policies</legend>
              <div className={styles.related}>
                {POLICY_IDS.filter((p) => p !== id).map((p) => (
                  <Checkbox
                    key={p}
                    label={POLICY_INFO[p].label}
                    description={`Linked from this page while it is published (${POLICY_INFO[p].route}).`}
                    checked={draft.relatedPolicies.includes(p)}
                    disabled={readOnly}
                    onChange={(e) => set({ relatedPolicies: e.target.checked ? [...draft.relatedPolicies, p] : draft.relatedPolicies.filter((x) => x !== p) })}
                  />
                ))}
              </div>
              {err("relatedPolicies") && <p className={blockStyles.error} role="alert">{err("relatedPolicies")}</p>}
            </fieldset>
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the website's own description for this page.">
          <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description") ?? err("seo")}>
            <Textarea rows={2} maxLength={200} value={draft.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} />
          </FormField>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={contentStyles.fields}>
            {record && record.status !== "archived" && record.status !== "published" && gaps.length > 0 && (
              <Alert tone="info" data-testid="policy-gaps">
                Before it can be approved it needs {gaps.join(", ").replace(/, ([^,]*)$/, " and $1")}.
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
        description="Archived, it leaves the website at the next publish, and the website shows its own page for this policy again."
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
