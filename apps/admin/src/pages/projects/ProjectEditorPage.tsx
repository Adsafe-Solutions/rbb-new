import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, Checkbox, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Spinner, Textarea } from "../../design-system";
import { projectsApi, type Project } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { ProgramSelect } from "../../content/pickers";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, ParagraphsField, TextField } from "../../blocks/fields";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";

/* One project — exactly what its page, the projects list, its program's
   page and the featured projects draw. Its program is chosen from this
   organization's programs. Plain text throughout. The address follows the
   title until edited by hand; the order is set on the list. */

const FIELDS = ["title", "slug", "programId", "description", "imageId", "context", "activities", "approach", "outcomes", "featured", "seo"] as const;

type Paragraphs = "context" | "approach";
type Lines = "activities" | "outcomes";
const PARAGRAPHS: { key: Paragraphs; label: string }[] = [
  { key: "context", label: "The challenge" },
  { key: "approach", label: "How the work is approached" },
];
const LINES: { key: Lines; label: string; item: string; add: string; helper?: string }[] = [
  { key: "activities", label: "What this work focuses on", item: "Focus", add: "Add a focus" },
  { key: "outcomes", label: "What it aims to change", item: "Aim", add: "Add an aim", helper: "Intended change, in words — never a result until it is verified." },
];

export default function ProjectEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Project>({ api: projectsApi, id: params.id!, base: "projects", fields: FIELDS, initial: { status: "draft" }, kind: "project" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the project" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This project doesn't exist" : "The project could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Project["seo"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...seo, ...changes }).filter(([, v]) => v !== undefined && v !== ""));
    editor.set({ seo: Object.keys(next).length ? next : undefined });
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New project"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "A piece of work under a program area, with its own page."} />
      <EditorNotices editor={editor} kind="project" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={160} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Stories name the project by it — change it only on purpose." disabled={readOnly} error={err("slug")}>
              <Input
                maxLength={120}
                value={d.slug ?? ""}
                onChange={(e) => {
                  setSlugTouched(true);
                  editor.set({ slug: e.target.value });
                }}
              />
            </FormField>
            <p className={styles.address} aria-label="Public address">
              /work/projects/{d.slug || "…"}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <ProgramSelect required value={d.programId} onChange={(programId) => editor.set({ programId })} error={err("programId")} disabled={readOnly} />
            <FormField label="Description" required helper="One line, under the title and on cards." disabled={readOnly} error={err("description")}>
              <Textarea rows={2} maxLength={400} value={d.description ?? ""} onChange={(e) => editor.set({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Photograph" helper="Beside the title and on cards. Describe it (alt text) in the media library before publishing." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
            <Checkbox label="Feature this project" description="Among the featured projects on Our Work and the homepage." checked={Boolean(d.featured)} disabled={readOnly} onChange={(e) => editor.set({ featured: e.target.checked || undefined })} />
          </div>
        </Panel>
        <Panel title="Page sections" as="h2" description="Each is optional; a section without content is left out.">
          <div className={styles.fields}>
            {PARAGRAPHS.map(({ key, label }) =>
              d[key] ? (
                <ParagraphsField key={key} label={label} helper="Separate paragraphs with a blank line. Clear it to leave the section out." value={d[key]!} onChange={(v) => editor.set({ [key]: v.join("") === "" ? undefined : v } as Partial<Project>)} error={err(key) ?? err(`${key}.0`)} disabled={readOnly} />
              ) : (
                <Checkbox key={key} label={`Write “${label}”`} checked={false} disabled={readOnly} onChange={(e) => e.target.checked && editor.set({ [key]: [""] } as Partial<Project>)} />
              )
            )}
            {LINES.map(({ key, label, item, add, helper }) => (
              <ItemList
                key={key}
                label={label}
                items={(d[key] as string[] | undefined) ?? []}
                max={12}
                disabled={readOnly}
                error={err(key)}
                itemLabel={(i) => `${item} ${i + 1}`}
                addLabel={add}
                onChange={(lines) => editor.set({ [key]: lines.length ? lines : undefined } as Partial<Project>)}
                make={() => ""}
                render={(line, setLine, i) => <TextField label={`${item} ${i + 1}`} required helper={helper} max={200} value={line} onChange={(v) => setLine(v ?? "")} error={err(`${key}.${i}`)} disabled={readOnly} />}
              />
            ))}
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the description and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the project's page is shared." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="project" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {d.status !== "archived" && <p className={styles.muted}>Stories name projects by their address: archiving or renaming one they name stops the website publish until they are updated.</p>}
            {!canEdit && <Alert tone="info">You can view this project but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="project" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
