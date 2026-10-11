import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner } from "../../design-system";
import { metricsApi, type Metric } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";

/* One headline figure: its value, what it counts, its key (what the
   homepage and the Impact page name it by) and its verification — exactly
   what the figure cards draw. Never a number the organization has not
   supplied; the site shows a figure while it awaits verification, and the
   release stays blocked until it is verified. The order is set on the
   list. */

const FIELDS = ["value", "label", "slug", "verification"] as const;

export default function MetricEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Metric>({ api: metricsApi, id: params.id!, base: "impact/figures", fields: FIELDS, initial: { verification: "pending-review", status: "draft" }, kind: "figure" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the figure" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This figure doesn't exist" : "The figure could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? `${editor.view.record.value} ${editor.view.record.label}` : "New figure"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "A headline figure, named by the homepage and the Impact page."} />
      <EditorNotices editor={editor} kind="figure" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="The figure" as="h2">
          <div className={styles.fields}>
            <FormField label="Value" required helper="As written on the website, e.g. 50K+, 25, 200+. Never a number the organization has not supplied." disabled={readOnly} error={err("value")}>
              <Input maxLength={16} value={d.value ?? ""} onChange={(e) => editor.set({ value: e.target.value })} />
            </FormField>
            <FormField label="What it counts" required helper="The label under the value." disabled={readOnly} error={err("label")}>
              <Input maxLength={120} value={d.label ?? ""} onChange={(e) => editor.set({ label: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value).split("-").slice(0, 3).join("-") }) })} />
            </FormField>
            <FormField label="Key" required helper="Lowercase words joined by hyphens. The homepage and the Impact page name the figure by it — change it only on purpose." disabled={readOnly} error={err("slug")}>
              <Input
                maxLength={120}
                value={d.slug ?? ""}
                onChange={(e) => {
                  setSlugTouched(true);
                  editor.set({ slug: e.target.value });
                }}
              />
            </FormField>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier keys: {editor.view.previousSlugs.join(", ")}</p>}
            <FormField label="Verification" helper="Has the organization verified this figure? An unverified figure is shown, without counting up, and keeps the release blocked." disabled={readOnly} error={err("verification")}>
              <Select
                options={[
                  { value: "pending-review", label: "Awaiting verification" },
                  { value: "verified", label: "Verified by the organization" },
                ]}
                value={d.verification ?? "pending-review"}
                onChange={(e) => editor.set({ verification: e.target.value as Metric["verification"] })}
              />
            </FormField>
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="figure" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {d.status !== "archived" && <p className={styles.muted}>The homepage and the Impact page name figures by key: archiving or re-keying one they name stops the website publish until they are updated.</p>}
            {!canEdit && <Alert tone="info">You can view this figure but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="figure" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
