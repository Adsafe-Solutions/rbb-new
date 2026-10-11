import { useCallback, useEffect, useState } from "react";
import { Alert, Button, FormField, Input, Select, Spinner } from "../design-system";
import { RecordPicker, type PickableRecord } from "../blocks/fields";
import { programsApi, projectsApi, storiesApi } from "./client";
import { readinessWord } from "./workflow";

/* M12: the relationship pickers — a program, a project, stories — from
   THIS organization's CMS records (every list is the signed-in member's
   organization's; the API refuses anything else). Archived records are
   not offered; a draft is offered and labelled, and the API refuses to
   approve a record that names one not yet approved or published (M14).

   Until the organization manages that collection here (no record yet),
   the website's own records are named by their address, typed as before:
   the website build checks them. A list that could not be LOADED is not
   an empty one (M48): it says so and offers to try again, and the value
   already chosen is kept as it is. */

export interface ReferenceOption {
  value: string;
  label: string;
  status: string;
  live?: boolean;
}

const STATUS_SUFFIX = (status: string, live?: boolean) => (readinessWord(status, live) === "published" ? "" : ` (${readinessWord(status, live)})`);

const loadPrograms = () =>
  programsApi.list({ pageSize: 100, sort: "updated" }).then(({ items }) =>
    items.filter((v) => v.record.status !== "archived").sort((a, b) => a.record.order - b.record.order).map((v) => ({ value: v.record.slug, label: v.record.title, status: v.record.status, live: v.live }))
  );
const loadProjects = () =>
  projectsApi.list({ pageSize: 100, sort: "updated" }).then(({ items }) =>
    items.filter((v) => v.record.status !== "archived").sort((a, b) => a.record.order - b.record.order).map((v) => ({ value: v.record.slug, label: v.record.title, status: v.record.status, live: v.live }))
  );

/* A picker's list: loading (null), loaded, or failed — with a retry. */
function useLoaded<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setItems(null);
    setFailed(false);
    load().then(
      (loaded) => live && setItems(loaded),
      () => live && setFailed(true)
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);
  return { items, failed, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

function LoadFailed({ label, plural, error, retry }: { label: string; plural: string; error?: string; retry: () => void }) {
  return (
    <Alert tone="danger" role="alert" title={label}>
      The {plural} could not be loaded, so none can be chosen right now. What is already chosen is kept.{error && ` ${error}`}{" "}
      <Button size="sm" onClick={retry}>
        Try again
      </Button>
    </Alert>
  );
}

function ReferenceSelect({ label, noun, value, onChange, load, required, helper, error, disabled, fallback }: { label: string; noun: string; value: string | undefined; onChange: (v: string | undefined) => void; load: () => Promise<ReferenceOption[]>; required?: boolean; helper?: string; error?: string; disabled: boolean; fallback?: string }) {
  const { items: options, failed, retry } = useLoaded(load);
  if (failed) return <LoadFailed label={label} plural={`${noun}s`} error={error} retry={retry} />;
  if (!options) return <Spinner label={`Loading the ${noun}s`} />;
  if (options.length === 0)
    return (
      <FormField label={label} required={required} helper={`${fallback ?? `No ${noun}s are managed here yet, so this names the website's own ${noun} by its address (e.g. education).`}${helper ? ` ${helper}` : ""}`} error={error} disabled={disabled}>
        <Input maxLength={120} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />
      </FormField>
    );
  const known = !value || options.some((o) => o.value === value);
  return (
    <FormField label={label} required={required} helper={helper} error={error} disabled={disabled}>
      <Select
        options={[
          ...(required ? (value ? [] : [{ value: "", label: `Choose a ${noun}` }]) : [{ value: "", label: "None" }]),
          ...(known ? [] : [{ value: value!, label: `“${value}” — not found` }]),
          ...options.map((o) => ({ value: o.value, label: `${o.label}${STATUS_SUFFIX(o.status, o.live)}` })),
        ]}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </FormField>
  );
}

export const ProgramSelect = (props: { label?: string; value: string | undefined; onChange: (v: string | undefined) => void; required?: boolean; helper?: string; error?: string; disabled: boolean }) => (
  <ReferenceSelect label={props.label ?? "Program area"} noun="program" load={loadPrograms} {...props} />
);
export const ProjectSelect = (props: { label?: string; value: string | undefined; onChange: (v: string | undefined) => void; required?: boolean; helper?: string; error?: string; disabled: boolean }) => (
  <ReferenceSelect label={props.label ?? "Project"} noun="project" load={loadProjects} {...props} />
);

/* Milestone 6: one story, by id (a project's linked story). This
   organization's stories by title; until it has one, the website's own
   story is named by its id, as the Impact page names them. */
const loadStoryOptions = () =>
  storiesApi.list({ pageSize: 100, sort: "updated" }).then(({ items }) => items.filter((v) => v.record.status !== "archived").map((v) => ({ value: v.record.id, label: v.record.title, status: v.record.status, live: v.live })));
export const StorySelect = (props: { label?: string; value: string | undefined; onChange: (v: string | undefined) => void; helper?: string; error?: string; disabled: boolean }) => (
  <ReferenceSelect label={props.label ?? "Story"} noun="story" load={loadStoryOptions} fallback="No stories are managed here yet, so this names one of the website's own stories by its id (e.g. learning-to-read)." {...props} />
);

/* Stories, by id, up to `max`, in the order chosen (related stories,
   /impact's stories). `except` leaves a story out (itself);
   `itemError` is the API's message for one chosen story, by id. */
export function StoriesField({ label, value, onChange, max, except, error, itemError, disabled }: { label: string; value: string[]; onChange: (ids: string[]) => void; max: number; except?: string; error?: string; itemError?: (id: string) => string | undefined; disabled: boolean }) {
  const loadStories = useCallback(
    () =>
      storiesApi
        .list({ pageSize: 100, sort: "updated" })
        .then(({ items }) => items.filter((v) => v.record.status !== "archived" && v.record.id !== except).map((v): PickableRecord => ({ id: v.record.id, title: v.record.title, status: v.record.status, live: v.live, detail: `/stories/${v.record.slug}` }))),
    [except]
  );
  const { items: stories, failed, retry } = useLoaded(loadStories);
  const load = useCallback(() => Promise.resolve(stories ?? []), [stories]);
  /* Without the checkboxes, every message is the field's, naming its story. */
  const allErrors = [error, ...value.map((id) => itemError?.(id) && `${id}: ${itemError(id)}`)].filter(Boolean).join(" ") || undefined;
  if (failed) return <LoadFailed label={label} plural="stories" error={allErrors} retry={retry} />;
  if (!stories) return <Spinner label="Loading the stories" />;
  if (stories.length === 0)
    return (
      <FormField label={label} helper="No stories are managed here yet, so this names the website's own stories by id, separated by commas. Once stories are added under Stories, choose them here." error={allErrors} disabled={disabled}>
        <Input value={value.join(", ")} onChange={(e) => onChange(e.target.value.split(/[\s,]+/).filter(Boolean))} />
      </FormField>
    );
  return <RecordPicker label={label} load={load} value={value} onChange={onChange} max={max} disabled={disabled} error={error} itemError={itemError} />;
}
