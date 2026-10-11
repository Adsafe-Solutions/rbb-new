import { useCan } from "../../auth";
import { Alert, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner } from "../../design-system";
import { reportsApi, type Report } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import type { PageProps } from "../../routes";
import { REPORT_CATEGORIES } from "../../transparency/categories";
import styles from "../../content/content.module.css";

/* One transparency document: which list it is on, its title, year and a
   short type label, and the https:// link to the file itself — exactly
   what the Transparency chapter draws. The media library holds images
   only, so the file lives where the organization publishes it; there is
   no upload here. Never a placeholder link. The order is set on the
   list. */

const FIELDS = ["category", "title", "year", "type", "fileUrl"] as const;

export default function ReportEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Report>({ api: reportsApi, id: params.id!, base: "transparency/documents", fields: FIELDS, initial: { category: "annualReport", status: "draft" }, kind: "document" });
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the document" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This document doesn't exist" : "The document could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New document"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "A document listed in the Transparency chapter of the About page."} />
      <EditorNotices editor={editor} kind="document" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="The document" as="h2">
          <div className={styles.fields}>
            <FormField label="List" required helper="Which list of the Transparency chapter it appears in." disabled={readOnly} error={err("category")}>
              <Select options={REPORT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={d.category ?? "annualReport"} onChange={(e) => editor.set({ category: e.target.value as Report["category"] })} />
            </FormField>
            <FormField label="Title" required helper="The link's words." disabled={readOnly} error={err("title")}>
              <Input maxLength={160} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value })} />
            </FormField>
            <div className={styles.row}>
              <FormField label="Year" helper="Optional." disabled={readOnly} error={err("year")}>
                <Input type="number" min={1900} max={2100} value={d.year ?? ""} onChange={(e) => editor.set({ year: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined })} />
              </FormField>
              <FormField label="Type" helper="Optional, e.g. PDF. Never a claim the document does not make (“audited”)." disabled={readOnly} error={err("type")}>
                <Input maxLength={40} value={d.type ?? ""} onChange={(e) => editor.set({ type: e.target.value || undefined })} />
              </FormField>
            </div>
            <FormField label="Link to the file" required helper="The https:// address where the organization publishes the file. The media library holds images only." disabled={readOnly} error={err("fileUrl")}>
              <Input type="url" inputMode="url" maxLength={2048} placeholder="https://" value={d.fileUrl ?? ""} onChange={(e) => editor.set({ fileUrl: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="document" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view this document but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="document" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
