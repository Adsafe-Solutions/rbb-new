import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { PUBLIC_SITE_URL } from "../../config";
import { Alert, Archive, Button, Dialog, EmptyState, ExternalLink, FormField, Input, PageContainer, PageHeader, Panel, Spinner, Textarea, useToast } from "../../design-system";
import type { ScheduleInput, WorkflowAction } from "../../content/client";
import { statusBadge } from "../../content/editor";
import { ACTED, WorkflowControls, isLocked } from "../../content/workflow";
import { CheckoutFields } from "../../donations/CheckoutFields";
import { DonationSections } from "../../donations/DonationSections";
import { donationPageApi, type DonationPageChanges, type DonationPageView, type GeneralDonationPage } from "../../donations/client";
import { MediaPicker } from "../../media/MediaPicker";
import { publishApi, type PublishStatus } from "../../settings/client";
import { PublishPanel } from "../settings/PublishPanel";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";

/* The general donation page — "give to the organization generally", the
   website's /appeals page. One per organization: no list, no create, just
   this editor. It is reviewed like every page (M14): submitted, approved
   by an owner (who verifies the Givebutter campaign), then put live by
   the owner's next site publish. Until then the website keeps its
   published version (or its own page); archiving withdraws it.

   Sections: content (the hero and the passages below the form), donation
   configuration (designation and the Givebutter checkout), SEO and
   publishing. Saves send whole parts with the revision they were based
   on; a stale one offers "Reload latest". */

type Draft = Partial<Pick<GeneralDonationPage, "hero" | "sections" | "donation" | "seo" | "status">>;
const PARTS = ["hero", "sections", "donation", "seo"] as const;
const INITIAL: Draft = { hero: { title: "", description: "", imageId: "" }, sections: [], donation: { designation: "where-needed-most" } };
const PUBLIC_PATH = "/appeals";

const draftOf = (view: DonationPageView): Draft => (view.record ? structuredClone(view.record) : structuredClone(INITIAL));

export default function DonationPageEditor() {
  const canEdit = useCan("content:update");
  const canApprove = useCan("content:approve");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [view, setView] = useState<DonationPageView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(async () => {
    setProblem(null);
    setErrors(new Map());
    try {
      const v = await donationPageApi.get();
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

  if (loadFailed) return <PageContainer width="narrow"><EmptyState title="The donation page could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!view) return <PageContainer width="narrow"><Spinner label="Loading the donation page" /></PageContainer>;

  const readOnly = !canEdit || isLocked(view.record?.status);
  const err = (path: string) => errors.get(path);
  const hero = draft.hero ?? INITIAL.hero!;
  const setHero = (changes: Partial<GeneralDonationPage["hero"]>) => {
    const next = Object.fromEntries(Object.entries({ ...hero, ...changes }).filter(([k, v]) => v !== undefined && (v !== "" || ["title", "description", "imageId"].includes(k))));
    setDraft((d) => ({ ...d, hero: next as GeneralDonationPage["hero"] }));
  };
  const context = hero.context;
  const setContext = (label: string, body: string) => {
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    setHero({ context: label || paragraphs.length ? { ...(label && { label }), body: paragraphs } : undefined });
  };
  const seo = draft.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<GeneralDonationPage["seo"]>>) => {
    const next = nextSeo(seo, changes);
    setDraft((d) => ({ ...d, seo: next }));
  };
  const donation = draft.donation ?? INITIAL.donation!;
  const setDonation = (changes: Partial<GeneralDonationPage["donation"]>) => {
    const next = Object.fromEntries(Object.entries({ ...donation, ...changes }).filter(([, v]) => v !== undefined));
    setDraft((d) => ({ ...d, donation: next as GeneralDonationPage["donation"] }));
  };

  async function save() {
    if (!view) return;
    setSaving(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const parts = view.record ? changed : PARTS.filter((p) => draft[p] !== undefined);
      const changes = Object.fromEntries(parts.map((p) => [p, draft[p] ?? null])) as DonationPageChanges;
      const next = await donationPageApi.update(view.revision, changes);
      setView(next);
      setDraft(draftOf(next));
      toast({ title: view.record ? "Saved" : "Donation page created", tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention before this can be saved." : caught.message });
      } else setProblem({ kind: "error", message: "The donation page could not be saved. Try again." });
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
      const next = await donationPageApi.schedule(view.revision, input);
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
      const next = await donationPageApi.unschedule(view.revision);
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

  /* A workflow transition — or archiving / reopening, a status save. */
  async function act(action: WorkflowAction | "archive" | "reopen") {
    if (!view) return;
    setActing(true);
    setProblem(null);
    setErrors(new Map());
    try {
      const next =
        action === "archive" || action === "reopen"
          ? await donationPageApi.update(view.revision, { status: action === "archive" ? "archived" : "draft" })
          : await donationPageApi.act(action, view.revision);
      setView(next);
      setDraft(draftOf(next));
      toast(action === "archive" ? { title: "Donation page archived", description: "After the next publish, the website shows its own donation page." } : action === "reopen" ? { title: "Reopened as a draft" } : { ...ACTED[action], tone: "success" });
      publishApi.status().then(setPublish, () => {});
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        setErrors(new Map(caught.details.map((d) => [d.path.replace(/^body\.(changes\.)?/, ""), d.message])));
        setProblem({ kind: "invalid", message: caught.message === "Request validation failed." ? "Some fields need attention first." : caught.message });
      } else if (caught instanceof ApiRequestError && caught.status === 403) setProblem({ kind: "error", message: caught.message });
      else setProblem({ kind: "error", message: "The donation page could not be changed. Try again." });
    } finally {
      setActing(false);
    }
  }

  const record = view.record;
  /* The working version is the one on the website (no pending changes). */
  const live = view.live && record?.status === "published";

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="General donation page"
        eyebrow={record ? statusBadge(record.status, view.live, view.schedule) : undefined}
        description={record && view.updatedAt ? `Last edited ${new Date(view.updatedAt).toLocaleString()} by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}.` : "Giving to the organization generally — the website's donation page. Until this page is published, the website keeps its own."}
      />
      {publish?.settingsReady && (
        <div className={styles.publish}>
          <PublishPanel status={publish} unsaved={dirty} onPublished={load} />
        </div>
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
        <Panel title="Content" as="h2" description="The opening beside the donation form, then what the page says below it.">
          <div className={styles.fields}>
            <FormField label="Eyebrow" helper="Optional. A short label above the title." disabled={readOnly} error={err("hero.eyebrow")}>
              <Input maxLength={60} value={hero.eyebrow ?? ""} onChange={(e) => setHero({ eyebrow: e.target.value })} />
            </FormField>
            <FormField label="Title" required disabled={readOnly} error={err("hero.title")}>
              <Input maxLength={120} value={hero.title} onChange={(e) => setHero({ title: e.target.value })} />
            </FormField>
            <FormField label="Introduction" required helper="What a general gift supports." disabled={readOnly} error={err("hero.description")}>
              <Textarea rows={3} maxLength={400} value={hero.description} onChange={(e) => setHero({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Image" helper="Required. Shown beside the donation form." value={hero.imageId || undefined} onChange={(imageId) => setHero({ imageId: imageId ?? "" })} disabled={readOnly} error={err("hero.imageId")} />
            <FormField label="Context label" helper="Optional. A short heading for the note beside the form, e.g. “Where your gift goes”." disabled={readOnly} error={err("hero.context.label")}>
              <Input maxLength={60} value={context?.label ?? ""} onChange={(e) => setContext(e.target.value, (context?.body ?? []).join("\n\n"))} />
            </FormField>
            <FormField label="Context note" helper="Optional. Paragraphs separated by a blank line." disabled={readOnly} error={err("hero.context.body") ?? err("hero.context")}>
              <Textarea rows={3} value={(context?.body ?? []).join("\n\n")} onChange={(e) => setContext(context?.label ?? "", e.target.value)} />
            </FormField>
          </div>
          <DonationSections value={draft.sections ?? []} onChange={(sections) => setDraft((d) => ({ ...d, sections }))} disabled={readOnly} error={err} path="sections" />
          {err("sections") && <Alert tone="danger">{err("sections")}</Alert>}
        </Panel>
        <Panel title="Donation configuration" as="h2" description="Givebutter takes and processes every gift. Only public identifiers are stored here; the website's form settings stay in Settings.">
          <div className={styles.fields}>
            <FormField label="Designation" required helper="Internal: what a general gift is for. Never shown to donors." disabled={readOnly} error={err("donation.designation")}>
              <Input maxLength={80} value={donation.designation} onChange={(e) => setDonation({ designation: e.target.value })} />
            </FormField>
            <CheckoutFields value={donation.checkout} onChange={(checkout) => setDonation({ checkout })} disabled={readOnly} error={err} path="donation.checkout" />
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the website's own title and description for this page.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the page is shared." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="page" />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {record ? (
              <WorkflowControls status={record.status} live={view.live} noun="donation page" canEdit={canEdit} canApprove={canApprove} dirty={dirty} busy={acting} onAct={act} publishedAt={record.publishedAt} schedule={view.schedule} onSchedule={scheduleIt} onUnschedule={unscheduleIt} onPublished={load} />
            ) : (
              <p className={styles.muted}>Create the page first; then submit it for review. A Givebutter campaign is checked with Givebutter when an owner approves it.</p>
            )}
            {record?.status === "archived" && canEdit && (
              <Alert tone="warning" title="This page is archived">
                The website shows its own donation page after the next publish.
                <span className={styles.inlineAction}>
                  <Button size="sm" loading={acting} onClick={() => act("reopen")}>
                    Reopen as draft
                  </Button>
                </span>
              </Alert>
            )}
            {record && record.status !== "archived" && canArchive && (
              <div>
                <Button variant="ghost" leadingIcon={<Archive />} onClick={() => setConfirmArchive(true)}>
                  Archive page
                </Button>
              </div>
            )}
            {live && PUBLIC_SITE_URL && (
              <p>
                <a className={styles.titleLink} href={`${PUBLIC_SITE_URL}${PUBLIC_PATH}`} target="_blank" rel="noreferrer">
                  Open on the website <ExternalLink size={14} aria-hidden="true" />
                </a>{" "}
                <span className={styles.muted}>(as of the last site publish)</span>
              </p>
            )}
            {!canEdit && <Alert tone="info">You can view this page but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      {canEdit && (
        <div className={styles.saveBar} data-dirty={dirty || undefined}>
          <span className={styles.saveState} aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : record ? `Saved · last by ${view.updatedBy!.isYou ? "you" : view.updatedBy!.name}` : "Not saved yet"}
          </span>
          <span className={styles.saveActions}>
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
              {record ? "Save" : "Create page"}
            </Button>
          </span>
        </div>
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        size="sm"
        title="Archive the donation page?"
        description="After the next publish, the website shows its own donation page again. Nothing is deleted."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setConfirmArchive(false);
                await act("archive");
              }}
            >
              Archive
            </Button>
          </>
        }
      />
    </PageContainer>
  );
}
