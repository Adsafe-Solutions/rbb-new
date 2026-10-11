import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, Button, Checkbox, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Spinner, Textarea } from "../../design-system";
import { projectsApi, type Project } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { paragraphsError } from "../../content/fieldErrors";
import { ProgramSelect, StorySelect } from "../../content/pickers";
import { listOrNone } from "../../content/storyFields";
import { FIGURE_LABEL_MAX, FIGURE_VALUE_MAX, IMPACT_FIGURES_MAX, LOCATION_MAX, PARTNERS_MAX, PARTNER_MAX, STAGE_MAX, figureProblems, partnerProblems, type ImpactFigure } from "../../content/projectFields";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, ParagraphsField, TextField } from "../../blocks/fields";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";

/* One project — exactly what its page, the projects list, its program's
   page and the featured projects draw. Its program is chosen from this
   organization's programs. Plain text throughout. The address follows the
   title until edited by hand; the order is set on the list.
   Milestone 6: its facts (location, stage, date), verified impact figures,
   partners and the story that tells its work (content/projectFields). */

const FIELDS = ["title", "slug", "programId", "description", "imageId", "context", "activities", "approach", "outcomes", "location", "stage", "date", "impact", "partners", "storyId", "featured", "seo"] as const;

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

/* M48: one editor per record. Creating one moves to its own address, and
   a fresh editor loads it there — so its address no longer follows the
   title, and nothing from the "new" form carries over. */
export default function ProjectEditorPage(props: PageProps) {
  return <ProjectEditor key={props.params.id} {...props} />;
}

function ProjectEditor({ params }: PageProps) {
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
        {editor.status === "missing" ? (
          <EmptyState title="This project doesn't exist" description="It may have been removed, or the link is wrong." />
        ) : (
          <EmptyState title="The project could not be loaded" description="Check the connection and try again." actions={<Button onClick={editor.retry}>Try again</Button>} />
        )}
      </PageContainer>
    );

  const figures: ImpactFigure[] = d.impact ?? [];
  const partners: string[] = d.partners ?? [];
  const figureIssues = figureProblems(figures);
  const partnerIssues = partnerProblems(partners);
  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Project["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
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
                <ParagraphsField key={key} label={label} helper="Separate paragraphs with a blank line. Clear it to leave the section out." value={d[key]!} onChange={(v) => editor.set({ [key]: v.join("") === "" ? undefined : v } as Partial<Project>)} error={paragraphsError(editor.errors, key)} disabled={readOnly} />
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
        <Panel title="Project facts" as="h2" description="Each optional, shown only when filled — as RBB states them.">
          <div className={styles.fields}>
            <div className={styles.row}>
              <FormField label="Location" helper="Where the work happens." disabled={readOnly} error={err("location")}>
                <Input maxLength={LOCATION_MAX} value={d.location ?? ""} onChange={(e) => editor.set({ location: e.target.value || undefined })} />
              </FormField>
              <FormField label="Stage" helper="Shown as its Status, e.g. Ongoing." disabled={readOnly} error={err("stage")}>
                <Input maxLength={STAGE_MAX} value={d.stage ?? ""} onChange={(e) => editor.set({ stage: e.target.value || undefined })} />
              </FormField>
            </div>
            <FormField label="Date" helper="Its date on the homepage's project timeline (newest first)." disabled={readOnly} error={err("date")}>
              <Input type="date" value={d.date ?? ""} onChange={(e) => editor.set({ date: e.target.value || undefined })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Impact and partners" as="h2" description="Results, never aims (aims are “What it aims to change”). Only figures the organization has verified: approving the project confirms them.">
          <div className={styles.fields}>
            <ItemList<ImpactFigure>
              label="Impact figures"
              items={figures}
              max={IMPACT_FIGURES_MAX}
              disabled={readOnly}
              error={err("impact")}
              itemLabel={(i) => `Figure ${i + 1}`}
              addLabel="Add a figure"
              onChange={(next) => editor.set({ impact: listOrNone(next) })}
              make={() => ({ value: "", label: "" })}
              render={(figure, set, i) => (
                <div className={styles.row}>
                  <FormField label="Figure" required helper="e.g. 120" disabled={readOnly} error={err(`impact.${i}.value`) ?? err(`impact.${i}`) ?? figureIssues.get(i)?.value}>
                    <Input maxLength={FIGURE_VALUE_MAX} value={figure.value} onChange={(e) => set({ ...figure, value: e.target.value })} />
                  </FormField>
                  <FormField label="What it counts" required helper="e.g. Children reading weekly" disabled={readOnly} error={err(`impact.${i}.label`) ?? figureIssues.get(i)?.label}>
                    <Input maxLength={FIGURE_LABEL_MAX} value={figure.label} onChange={(e) => set({ ...figure, label: e.target.value })} />
                  </FormField>
                </div>
              )}
            />
            <ItemList<string>
              label="Partners"
              items={partners}
              max={PARTNERS_MAX}
              disabled={readOnly}
              error={err("partners")}
              itemLabel={(i) => `Partner ${i + 1}`}
              addLabel="Add a partner"
              onChange={(next) => editor.set({ partners: listOrNone(next) })}
              make={() => ""}
              render={(name, set, i) => (
                <FormField label={`Partner ${i + 1}`} required disabled={readOnly} error={err(`partners.${i}`) ?? partnerIssues.get(i)}>
                  <Input maxLength={PARTNER_MAX} value={name} onChange={(e) => set(e.target.value)} />
                </FormField>
              )}
            />
          </div>
        </Panel>
        <Panel title="Story" as="h2" description="The story that tells this project's work: its title and excerpt are shown on the project page. If the story names this project too, the project can be approved while the story is in review.">
          <StorySelect value={d.storyId} onChange={(storyId) => editor.set({ storyId })} error={err("storyId")} disabled={readOnly} />
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
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="project page" />
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
