import { useMemo, useState } from "react";
import { useCan } from "../../auth";
import { Alert, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { eventsApi, fromTimeInput, toTimeInput, type Event } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { RichTextEditor } from "../../content/RichTextEditor";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";

/* One event. Date and times are what the event says, in its own time
   zone — nothing is converted. The API checks the end is after the start
   and that the zone is real. */

const FIELDS = ["title", "slug", "subtitle", "summary", "about", "date", "startTime", "endTime", "timezone", "venue", "address", "mapUrl", "registrationUrl", "imageId", "seo"] as const;

export default function EventEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Event>({ api: eventsApi, id: params.id!, base: "events", fields: FIELDS, initial: { status: "draft" }, kind: "event" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const zones = useMemo(() => [{ value: "", label: "Choose a time zone" }, ...Intl.supportedValuesOf("timeZone").map((z) => ({ value: z, label: z.replace(/_/g, " ") }))], []);
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);
  const timeOrder = d.startTime && d.endTime && toTimeInput(d.endTime) <= toTimeInput(d.startTime) ? "The end must be after the start." : undefined;

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the event" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This event doesn't exist" : "The event could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Event["seo"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...seo, ...changes }).filter(([, v]) => v !== undefined && v !== ""));
    editor.set({ seo: Object.keys(next).length ? next : undefined });
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.title : "New event"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "Add an event to the website."} />
      <EditorNotices editor={editor} kind="event" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={160} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Unique across events." disabled={readOnly} error={err("slug")}>
              <Input maxLength={120} value={d.slug ?? ""} onChange={(e) => (setSlugTouched(true), editor.set({ slug: e.target.value }))} />
            </FormField>
            <p className={styles.address} aria-label="Public address">/media/events/{d.slug || "…"}</p>
            <FormField label="Subtitle" disabled={readOnly} error={err("subtitle")}>
              <Input maxLength={200} value={d.subtitle ?? ""} onChange={(e) => editor.set({ subtitle: e.target.value })} />
            </FormField>
            <FormField label="Summary" required helper="One or two sentences shown in lists." disabled={readOnly} error={err("summary")}>
              <Textarea rows={2} maxLength={400} value={d.summary ?? ""} onChange={(e) => editor.set({ summary: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Date & time" as="h2" description="As the event is advertised, in its own time zone.">
          <div className={styles.fields}>
            <div className={styles.row}>
              <FormField label="Date" required disabled={readOnly} error={err("date")}>
                <Input type="date" value={d.date ?? ""} onChange={(e) => editor.set({ date: e.target.value || undefined })} />
              </FormField>
              <FormField label="Starts" required disabled={readOnly} error={err("startTime")}>
                <Input type="time" value={toTimeInput(d.startTime)} onChange={(e) => editor.set({ startTime: fromTimeInput(e.target.value) })} />
              </FormField>
              <FormField label="Ends" disabled={readOnly} error={err("endTime") ?? timeOrder}>
                <Input type="time" value={toTimeInput(d.endTime)} onChange={(e) => editor.set({ endTime: fromTimeInput(e.target.value) })} />
              </FormField>
            </div>
            <FormField label="Time zone" required helper="Where the times above apply, for example Europe/London." disabled={readOnly} error={err("timezone")}>
              <Select options={zones} value={d.timezone ?? ""} onChange={(e) => editor.set({ timezone: e.target.value || undefined })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Location" as="h2">
          <div className={styles.fields}>
            <FormField label="Venue" required disabled={readOnly} error={err("venue")}>
              <Input maxLength={160} value={d.venue ?? ""} onChange={(e) => editor.set({ venue: e.target.value })} />
            </FormField>
            <FormField label="Address" required disabled={readOnly} error={err("address")}>
              <Textarea rows={2} maxLength={300} value={d.address ?? ""} onChange={(e) => editor.set({ address: e.target.value })} />
            </FormField>
            <FormField label="Map link" helper="An https:// link to the place on a map (optional)." disabled={readOnly} error={err("mapUrl")}>
              <Input type="url" maxLength={2048} value={d.mapUrl ?? ""} onChange={(e) => editor.set({ mapUrl: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Registration" as="h2">
          <FormField label="Registration link" helper="An https:// page where people register (optional)." disabled={readOnly} error={err("registrationUrl")}>
            <Input type="url" maxLength={2048} value={d.registrationUrl ?? ""} onChange={(e) => editor.set({ registrationUrl: e.target.value })} />
          </FormField>
        </Panel>
        <Panel title="Content" as="h2">
          <RichTextEditor label="About the event" required value={d.about} onChange={(about) => editor.set({ about })} disabled={readOnly} error={err("about") ?? [...editor.errors.keys()].filter((k) => k.startsWith("about.")).map((k) => editor.errors.get(k)).join(" ")} helper="What happens, who it is for." />
        </Panel>
        <Panel title="Featured image" as="h2">
          <MediaPicker label="Image" helper="Required. Shown on the event page and in lists." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the title, the summary and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the event is shared. Defaults to the featured image." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="event" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
{!canEdit && <Alert tone="info">You can view this event but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="event" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
