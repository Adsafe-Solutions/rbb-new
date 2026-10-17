import { useEffect, useMemo, useState } from "react";
import { newEventRegistration } from "@rbb/content-schema/form-defaults";
import { useCan } from "../../auth";
import { Alert, Badge, Button, Checkbox, EmptyState, FormField, Inbox, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { navigate } from "../../router";
import { cleanRegistration, errorsUnder } from "../../forms/builder";
import { FieldsBuilder } from "../../forms/FieldsBuilder";
import { submissionsApi } from "../../submissions/client";
import { eventsApi, fromTimeInput, toTimeInput, type Event } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { RichTextEditor } from "../../content/RichTextEditor";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";
import { ProgramSelect } from "../../content/pickers";
import { SCHEDULE_MAX, scheduleProblems, zoneOptions, type ScheduleStep } from "../../content/eventFields";
import { ItemList } from "../../blocks/fields";

/* One event. Date and times are what the event says, in its own time
   zone — nothing is converted, and the zone is chosen here, never taken
   from the browser. The API checks the end is after the start, the zone is
   real, the start happens in that zone on that day, and every timed
   schedule step falls within the event, in order (content/eventFields
   shows the same problems beside each step first). Milestone 4: the
   program area (None = open to all) and the day's schedule.

   Registration (2026-10-17): a form on the event's own page
   (forms/FieldsBuilder), opened in a popup there — or none. People
   register on RBB's website only: there is no link to another site
   (owner decision, 2026-10-17); an older event's link is not shown on the
   website and can be removed here. The API takes registrations against
   the PUBLISHED event (`event-<id>` in Form submissions), so the form's
   changes go live when the event is published. Turning the form off
   clears it: the save sends null. */

const FIELDS = ["title", "slug", "subtitle", "summary", "about", "date", "startTime", "endTime", "timezone", "programId", "schedule", "venue", "address", "mapUrl", "registrationUrl", "registration", "imageId", "seo"] as const;

export default function EventEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Event>({ api: eventsApi, id: params.id!, base: "events", fields: FIELDS, initial: { status: "draft" }, kind: "event", prepare: (draft) => (draft.registration ? { ...draft, registration: cleanRegistration(draft.registration) } : draft) });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const registered = useRegistrations(editor.view?.record.id);
  const zones = useMemo(() => zoneOptions(d.timezone, Intl.supportedValuesOf("timeZone")), [d.timezone]);
  const schedule: ScheduleStep[] = d.schedule ?? [];
  const stepProblems = scheduleProblems(d.startTime, d.endTime, schedule);
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

  /* On: the event's form (a new one starts from the default questions),
     and any older registration link goes — the two never coexist. */
  const setRegistering = (on: boolean) => editor.set(on ? { registration: d.registration ?? newEventRegistration(), registrationUrl: undefined } : { registration: undefined });
  const setRegistration = (changes: Partial<NonNullable<Event["registration"]>>) => d.registration && editor.set({ registration: { ...d.registration, ...changes } });

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Event["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
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
            <ProgramSelect helper="None means the event is open to all." value={d.programId ?? undefined} onChange={(programId) => editor.set({ programId: programId ?? null })} error={err("programId")} disabled={readOnly} />
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
            <FormField label="Time zone" required helper="Where the times above apply, for example Europe/London. The website shows the times exactly as entered, naming this zone." disabled={readOnly} error={err("timezone")}>
              <Select options={zones} value={d.timezone ?? ""} onChange={(e) => editor.set({ timezone: e.target.value || undefined })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Schedule" as="h2" description="How the day runs, in order (optional). A time is optional; a timed step falls between the start and the end.">
          <ItemList<ScheduleStep>
            label="Schedule steps"
            items={schedule}
            onChange={(steps) => editor.set({ schedule: steps })}
            make={() => ({ item: "" })}
            max={SCHEDULE_MAX}
            disabled={readOnly}
            itemLabel={(i) => `Step ${i + 1}`}
            addLabel="Add a step"
            error={err("schedule")}
            render={(step, set, i) => (
              <div className={styles.row}>
                <FormField label="Time" helper="Optional." disabled={readOnly} error={err(`schedule.${i}.time`) ?? stepProblems.get(i)?.time}>
                  <Input type="time" value={toTimeInput(step.time)} onChange={(e) => set({ item: step.item, ...(fromTimeInput(e.target.value) && { time: fromTimeInput(e.target.value) }) })} />
                </FormField>
                <FormField label="What happens" required disabled={readOnly} error={err(`schedule.${i}.item`) ?? stepProblems.get(i)?.item}>
                  <Input maxLength={200} value={step.item} onChange={(e) => set({ ...step, item: e.target.value })} />
                </FormField>
              </div>
            )}
          />
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
        <Panel title="Registration" as="h2" description="People register on the event's page: its Register button opens this form in a popup. The form is checked against the published event, so changes to it go live when the event is published to the website. Each registration is emailed to RBB's events inbox (when one is set up) and the person gets a confirmation email.">
          <div className={styles.fields}>
            <Checkbox
              label="People can register for this event"
              description="Adds a Register button to the event page, which opens the registration form. You choose the questions."
              checked={Boolean(d.registration)}
              disabled={readOnly}
              onChange={(e) => setRegistering(e.target.checked)}
            />
            {err("registration") && <Alert tone="danger">{err("registration")}</Alert>}
            {d.registrationUrl && (
              <Alert tone="info">
                This event still has an older registration link to another website ({d.registrationUrl}). The website no longer shows it — people register on the event page.{" "}
                <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => editor.set({ registrationUrl: undefined })}>
                  Remove the link
                </Button>
              </Alert>
            )}
            {err("registrationUrl") && <Alert tone="danger">{err("registrationUrl")}</Alert>}
            {d.registration && (
              <>
                {registered && (
                  <div className={styles.saveActions} aria-label="Registrations">
                    <Badge tone={registered.new ? "info" : "neutral"}>
                      {registered.total === 1 ? "1 registration" : `${registered.total} registrations`}
                      {registered.new ? ` (${registered.new} new)` : ""}
                    </Badge>
                    {d.registration.capacity !== undefined && <Badge tone={registered.total >= d.registration.capacity ? "warning" : "neutral"}>Places left: {Math.max(0, d.registration.capacity - registered.total)}</Badge>}
                    <Button size="sm" leadingIcon={<Inbox />} onClick={() => navigate(`/submissions?form=event-${editor.view!.record.id}`)}>
                      View registrations
                    </Button>
                  </div>
                )}
                <Checkbox
                  label="Taking registrations"
                  description="Untick to stop sign-ups: the form stays on the event page, closed. Registrations also stop when the event is over or the places are taken."
                  checked={d.registration.open}
                  disabled={readOnly}
                  onChange={(e) => setRegistration({ open: e.target.checked })}
                />
                <FormField label="Spots" helper="How many people can register. Leave blank if it is not limited." disabled={readOnly} error={err("registration.capacity")}>
                  <Input type="number" min={1} max={100000} step={1} value={d.registration.capacity ?? ""} onChange={(e) => setRegistration({ capacity: e.target.value.trim() === "" ? undefined : Math.trunc(Number(e.target.value)) || undefined })} />
                </FormField>
                <FormField label="Button text" required disabled={readOnly} error={err("registration.submitLabel")}>
                  <Input maxLength={40} value={d.registration.submitLabel} onChange={(e) => setRegistration({ submitLabel: e.target.value })} />
                </FormField>
                <FormField label="Message after registering" required helper="Shown on the page once someone has registered." disabled={readOnly} error={err("registration.successMessage")}>
                  <Textarea rows={2} maxLength={300} value={d.registration.successMessage} onChange={(e) => setRegistration({ successMessage: e.target.value })} />
                </FormField>
                <FieldsBuilder fields={d.registration.fields} onChange={(fields) => setRegistration({ fields })} kind="event" disabled={readOnly} errors={errorsUnder(editor.errors, "registration.fields")} />
              </>
            )}
          </div>
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
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="event" />
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

/* The saved event's registrations so far (Form submissions, `event-<id>`),
   for owners who can read them; nothing when the call fails. */
function useRegistrations(eventId: string | undefined) {
  const canRead = useCan("submissions:read");
  const [totals, setTotals] = useState<{ total: number; new: number } | null>(null);
  useEffect(() => {
    if (!eventId || !canRead) return;
    let live = true;
    submissionsApi.totals(`event-${eventId}`).then((t) => live && setTotals(t), () => undefined);
    return () => {
      live = false;
    };
  }, [eventId, canRead]);
  return eventId && canRead ? totals : null;
}
