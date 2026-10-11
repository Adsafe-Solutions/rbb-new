import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, Button, Checkbox, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { storiesApi, type Post } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { referenceErrors } from "../../content/fieldErrors";
import { ProgramSelect, ProjectSelect, StoriesField } from "../../content/pickers";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { RichTextEditor } from "../../content/RichTextEditor";
import { ItemList } from "../../blocks/fields";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { STORY_CATEGORIES } from "../../stories/categories";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";
import { ATTRIBUTION_MAX, IMPACT_LINE_MAX, IMPACT_MAX, QUOTES_MAX, QUOTE_TEXT_MAX, impactProblems, listOrNone, quoteProblems, type StoryQuote } from "../../content/storyFields";

/* One story — a post of type "story" (M12). Sections: basic information,
   the story (rich text — never HTML), images, related work, SEO,
   publishing. Exactly what the story page, the hub, the homepage and
   /impact draw. The program, project and related stories are chosen from
   this organization's records; the address follows the title until it is
   edited by hand. Real stories only, approved by the organization and with
   the consent of anyone they describe: nothing here is sample content.
   Milestone 5: quotes (pull-quotes after the story) and impact (its
   "Impact" row) — public as written; an emptied list is cleared
   (content/storyFields). */

const FIELDS = ["title", "slug", "category", "excerpt", "date", "author", "location", "imageId", "body", "programId", "projectId", "featured", "galleryIds", "relatedPostIds", "quotes", "impact", "seo"] as const;

/* M48: one editor per record. Creating one moves to its own address, and
   a fresh editor loads it there — so its address no longer follows the
   title, and nothing from the "new" form carries over. */
export default function StoryEditorPage(props: PageProps) {
  return <StoryEditor key={props.params.id} {...props} />;
}

function StoryEditor({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Post>({ api: storiesApi, id: params.id!, base: "stories", fields: FIELDS, initial: { category: "field", status: "draft" }, kind: "story" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the story" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        {editor.status === "missing" ? (
          <EmptyState title="This story doesn't exist" description="It may have been removed, or the link is wrong." />
        ) : (
          <EmptyState title="The story could not be loaded" description="Check the connection and try again." actions={<Button onClick={editor.retry}>Try again</Button>} />
        )}
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Post["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
  };
  const gallery = d.galleryIds ?? [];
  const quotes: StoryQuote[] = d.quotes ?? [];
  const impact: string[] = d.impact ?? [];
  const quoteIssues = quoteProblems(quotes);
  const impactIssues = impactProblems(impact);
  const related = referenceErrors(editor.errors, "relatedPostIds", d.relatedPostIds ?? []);

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New story"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "A story from the work, approved by the organization."} />
      <EditorNotices editor={editor} kind="story" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={160} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Unique across stories and posts." disabled={readOnly} error={err("slug")}>
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
              /stories/{d.slug || "…"}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <FormField label="Type of story" required disabled={readOnly} error={err("category")}>
              <Select options={STORY_CATEGORIES} value={d.category ?? "field"} onChange={(e) => editor.set({ category: e.target.value })} />
            </FormField>
            <FormField label="Excerpt" helper="One or two sentences shown on cards and under the title." disabled={readOnly} error={err("excerpt")}>
              <Textarea rows={2} maxLength={400} value={d.excerpt ?? ""} onChange={(e) => editor.set({ excerpt: e.target.value || undefined })} />
            </FormField>
            <div className={styles.row}>
              <FormField label="Date" helper="Optional. Stories are listed newest first." disabled={readOnly} error={err("date")}>
                <Input type="date" value={d.date ?? ""} onChange={(e) => editor.set({ date: e.target.value || undefined })} />
              </FormField>
              <FormField label="Author" helper="Optional. Only a real, consenting author." disabled={readOnly} error={err("author")}>
                <Input maxLength={120} value={d.author ?? ""} onChange={(e) => editor.set({ author: e.target.value || undefined })} />
              </FormField>
            </div>
            <FormField label="Location" helper="Optional. Only where the organization has confirmed it." disabled={readOnly} error={err("location")}>
              <Input maxLength={120} value={d.location ?? ""} onChange={(e) => editor.set({ location: e.target.value || undefined })} />
            </FormField>
            <Checkbox label="Feature this story on the stories page" description="One story at a time; the website publish refuses two." checked={Boolean(d.featured)} disabled={readOnly} onChange={(e) => editor.set({ featured: e.target.checked || undefined })} />
          </div>
        </Panel>
        <Panel title="The story" as="h2">
          <RichTextEditor label="Story" required value={d.body} onChange={(body) => editor.set({ body })} disabled={readOnly} error={err("body") ?? [...editor.errors.keys()].filter((k) => k.startsWith("body.")).map((k) => editor.errors.get(k)).join(" ")} helper="In paragraphs, headings and lists. The first paragraph opens with a drop cap." />
        </Panel>
        <Panel title="Quotes" as="h2" description="Shown after the story, each as a pull-quote. Only words a real person said, with RBB's approval and that person's permission.">
          <ItemList<StoryQuote>
            label="Quotes"
            items={quotes}
            max={QUOTES_MAX}
            disabled={readOnly}
            error={err("quotes")}
            itemLabel={(i) => `Quote ${i + 1}`}
            addLabel="Add a quote"
            onChange={(next) => editor.set({ quotes: listOrNone(next) })}
            make={() => ({ text: "", attribution: "" })}
            render={(quote, set, i) => (
              <div className={styles.fields}>
                <FormField label="Words" required disabled={readOnly} error={err(`quotes.${i}.text`) ?? err(`quotes.${i}`) ?? quoteIssues.get(i)?.text}>
                  <Textarea rows={3} maxLength={QUOTE_TEXT_MAX} value={quote.text} onChange={(e) => set({ ...quote, text: e.target.value })} />
                </FormField>
                <FormField label="Who said it" required helper="As it should appear on the page." disabled={readOnly} error={err(`quotes.${i}.attribution`) ?? quoteIssues.get(i)?.attribution}>
                  <Input maxLength={ATTRIBUTION_MAX} value={quote.attribution ?? ""} onChange={(e) => set({ ...quote, attribution: e.target.value })} />
                </FormField>
              </div>
            )}
          />
        </Panel>
        <Panel title="Impact" as="h2" description="The change this story documents, one line each, shown as written in the story's Impact section. Only what the organization has confirmed.">
          <ItemList<string>
            label="Impact lines"
            items={impact}
            max={IMPACT_MAX}
            disabled={readOnly}
            error={err("impact")}
            itemLabel={(i) => `Line ${i + 1}`}
            addLabel="Add a line"
            onChange={(next) => editor.set({ impact: listOrNone(next) })}
            make={() => ""}
            render={(line, set, i) => (
              <FormField label={`Line ${i + 1}`} disabled={readOnly} error={err(`impact.${i}`) ?? impactIssues.get(i)}>
                <Input maxLength={IMPACT_LINE_MAX} value={line} onChange={(e) => set(e.target.value)} />
              </FormField>
            )}
          />
        </Panel>
        <Panel title="Images" as="h2" description="From the media library, each described (alt text) before the story is published.">
          <div className={styles.fields}>
            <MediaPicker label="Image" helper="At the top of the story and on its card." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
            <ItemList
              label="Gallery"
              items={gallery}
              max={12}
              disabled={readOnly}
              error={err("galleryIds")}
              itemLabel={(i) => `Gallery image ${i + 1}`}
              addLabel="Add a gallery image"
              onChange={(ids) => editor.set({ galleryIds: ids.length ? ids : undefined })}
              make={() => ""}
              render={(id, setId, i) => <MediaPicker label={`Gallery image ${i + 1}`} value={id || undefined} onChange={(next) => setId(next ?? "")} disabled={readOnly} error={err(`galleryIds.${i}`)} />}
            />
          </div>
        </Panel>
        <Panel title="Related work" as="h2" description="Chosen from this organization's programs, projects and stories.">
          <div className={styles.fields}>
            <ProgramSelect value={d.programId} onChange={(programId) => editor.set({ programId })} error={err("programId")} disabled={readOnly} />
            <ProjectSelect value={d.projectId} onChange={(projectId) => editor.set({ projectId })} error={err("projectId")} disabled={readOnly} />
            <StoriesField label="Related stories" value={d.relatedPostIds ?? []} onChange={(ids) => editor.set({ relatedPostIds: ids.length ? ids : undefined })} max={6} except={editor.view?.record.id} error={related.field} itemError={(id) => related.byId.get(id)} disabled={readOnly} />
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the title, the excerpt and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the story is shared. Defaults to its image." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="story" />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="story" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view this story but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="story" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
