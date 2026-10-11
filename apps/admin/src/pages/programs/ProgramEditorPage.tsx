import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, Checkbox, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { programsApi, type Program } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, ParagraphsField, TextField } from "../../blocks/fields";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";

/* One program area. Sections: basic information, its page's sections,
   SEO, publishing — exactly what the program page, Our Work, the menu and
   the homepage's cards draw. Plain text throughout (the pages draw text,
   not formatting). The address follows the title until edited by hand;
   the order is set on the program list. */

const FIELDS = ["title", "slug", "icon", "description", "missingNote", "why", "activities", "impact", "stories", "seo"] as const;

/* The site's line glyphs a program can use (the contract's PROGRAM_ICONS). */
const ICONS: { value: Program["icon"]; label: string }[] = [
  { value: "education", label: "Education (book)" },
  { value: "health", label: "Health (heart)" },
  { value: "livelihoods", label: "Livelihoods (growth)" },
  { value: "community", label: "Community (people)" },
  { value: "donate", label: "Donate" },
  { value: "volunteer", label: "Volunteer" },
  { value: "partner", label: "Partner" },
  { value: "fellowship", label: "Fellowship" },
  { value: "travel", label: "Travel" },
  { value: "fundraise", label: "Fundraise" },
  { value: "document", label: "Document" },
  { value: "shield", label: "Shield" },
  { value: "chart", label: "Chart" },
];

/* The program page's list sections, by their headings on the website. */
type Lines = "activities" | "impact" | "stories";
const LINES: { key: Lines; label: string; item: string; add: string; max: number }[] = [
  { key: "activities", label: "What we focus on", item: "Focus", add: "Add a focus", max: 200 },
  { key: "impact", label: "The change we work towards", item: "Change", add: "Add a change", max: 200 },
  { key: "stories", label: "Stories", item: "Story", add: "Add a story", max: 300 },
];

export default function ProgramEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Program>({ api: programsApi, id: params.id!, base: "programs", fields: FIELDS, initial: { icon: "education", status: "draft" }, kind: "program" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the program" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This program doesn't exist" : "The program could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Program["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New program"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "An area of work, with its own page."} />
      <EditorNotices editor={editor} kind="program" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={80} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Other content names the program by it — change it only on purpose." disabled={readOnly} error={err("slug")}>
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
              /work/{d.slug || "…"}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <FormField label="Icon" helper="The line glyph on its page and card." disabled={readOnly} error={err("icon")}>
              <Select options={ICONS} value={d.icon ?? "education"} onChange={(e) => editor.set({ icon: e.target.value as Program["icon"] })} />
            </FormField>
            <FormField label="Description" required helper="One line, under the title and on cards." disabled={readOnly} error={err("description")}>
              <Textarea rows={2} maxLength={300} value={d.description ?? ""} onChange={(e) => editor.set({ description: e.target.value })} />
            </FormField>
            <FormField label="Note for sections without content" helper="Optional. Shown under “Why this matters” and “What we focus on” while either is empty, in the program's own words." disabled={readOnly} error={err("missingNote")}>
              <Textarea rows={2} maxLength={300} value={d.missingNote ?? ""} onChange={(e) => editor.set({ missingNote: e.target.value || undefined })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Page sections" as="h2" description="Each is optional. An empty section keeps its heading on the website and says its content is still to come.">
          <div className={styles.fields}>
            {d.why ? (
              <ParagraphsField label="Why this matters" helper="Separate paragraphs with a blank line. Clear it to leave the section empty." value={d.why} onChange={(why) => editor.set({ why: why.join("") === "" ? undefined : (why as Program["why"]) })} error={err("why") ?? err("why.0")} disabled={readOnly} />
            ) : (
              <Checkbox label="Write “Why this matters”" checked={false} disabled={readOnly} onChange={(e) => e.target.checked && editor.set({ why: [""] as unknown as Program["why"] })} />
            )}
            {LINES.map(({ key, label, item, add, max }) => (
              <ItemList
                key={key}
                label={label}
                items={(d[key] as string[] | undefined) ?? []}
                max={12}
                disabled={readOnly}
                error={err(key)}
                itemLabel={(i) => `${item} ${i + 1}`}
                addLabel={add}
                onChange={(lines) => editor.set({ [key]: lines.length ? lines : undefined } as Partial<Program>)}
                make={() => ""}
                render={(line, setLine, i) => <TextField label={`${item} ${i + 1}`} required max={max} value={line} onChange={(v) => setLine(v ?? "")} error={err(`${key}.${i}`)} disabled={readOnly} />}
              />
            ))}
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the program's description and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the program's page is shared." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="program page" />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="program" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {d.status !== "archived" && <p className={styles.muted}>Projects, stories and events name programs by their address: archiving or renaming one that they name stops the website build until they are updated.</p>}
            {!canEdit && <Alert tone="info">You can view this program but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="program" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
