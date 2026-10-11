import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { postsApi, type Post } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { RichTextEditor } from "../../content/RichTextEditor";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "./slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";
import { ProgramSelect } from "../../content/pickers";
import { BLOG_CATEGORIES, typeChange } from "../../content/postFields";

/* One post. Sections: basic information, content, featured image, SEO,
   publishing. The address follows the title until it is edited by hand.
   Milestone 4: a news item names its program area, a blog post its
   category — each optional, each only on its own type (content/postFields). */

const FIELDS = ["type", "title", "slug", "excerpt", "date", "author", "category", "programId", "imageId", "body", "seo"] as const;
const PATHS = { news: "/media/news/", blog: "/media/blogs/", story: "/stories/" } as const;

export default function PostEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Post>({ api: postsApi, id: params.id!, base: "posts", fields: FIELDS, initial: { type: "news", status: "draft" }, kind: "post" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the post" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This post doesn't exist" : "The post could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Post["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New post"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "Write a news item or blog article."} />
      <EditorNotices editor={editor} kind="post" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Type" disabled={readOnly} error={err("type")}>
              <Select options={[{ value: "news", label: "News" }, { value: "blog", label: "Blog" }]} value={d.type ?? "news"} onChange={(e) => editor.set(typeChange(e.target.value as "news" | "blog"))} />
            </FormField>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={160} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Unique across posts." disabled={readOnly} error={err("slug")}>
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
              {PATHS[d.type ?? "news"]}
              {d.slug || "…"}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <FormField label="Excerpt" helper="One or two sentences shown in lists and under the title." disabled={readOnly} error={err("excerpt")}>
              <Textarea rows={2} maxLength={400} value={d.excerpt ?? ""} onChange={(e) => editor.set({ excerpt: e.target.value })} />
            </FormField>
            <div className={styles.row}>
              <FormField label="Date" helper="The date shown with the post." disabled={readOnly} error={err("date")}>
                <Input type="date" value={d.date ?? ""} onChange={(e) => editor.set({ date: e.target.value || undefined })} />
              </FormField>
              <FormField label="Author" disabled={readOnly} error={err("author")}>
                <Input maxLength={120} value={d.author ?? ""} onChange={(e) => editor.set({ author: e.target.value })} />
              </FormField>
            </div>
            {(d.type ?? "news") === "news" ? (
              <ProgramSelect helper="Optional. Shown with the item in the news timeline." value={d.programId} onChange={(programId) => editor.set({ programId })} error={err("programId")} disabled={readOnly} />
            ) : (
              <FormField label="Category" helper="Optional. Readers can filter the blog by it; without one the post is listed under All only." disabled={readOnly} error={err("category")}>
                <Select options={[{ value: "", label: "None" }, ...(d.category && !BLOG_CATEGORIES.some((c) => c.value === d.category) ? [{ value: d.category, label: `“${d.category}” — not a blog category` }] : []), ...BLOG_CATEGORIES]} value={d.category ?? ""} onChange={(e) => editor.set({ category: e.target.value || undefined })} />
              </FormField>
            )}
          </div>
        </Panel>
        <Panel title="Content" as="h2">
          <RichTextEditor label="Body" required value={d.body} onChange={(body) => editor.set({ body })} disabled={readOnly} error={err("body") ?? [...editor.errors.keys()].filter((k) => k.startsWith("body.")).map((k) => editor.errors.get(k)).join(" ")} helper="The article, in paragraphs, headings and lists." />
        </Panel>
        <Panel title="Featured image" as="h2">
          <MediaPicker label="Image" helper="Shown at the top of the post and in lists." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the title, the excerpt and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the post is shared. Defaults to the featured image." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="post" />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="post" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view this post but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="post" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
