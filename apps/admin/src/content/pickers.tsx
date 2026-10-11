import { useCallback, useEffect, useState } from "react";
import { FormField, Input, Select, Spinner } from "../design-system";
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
   the website build checks them. */

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

function useOptions(load: () => Promise<ReferenceOption[]>) {
  const [options, setOptions] = useState<ReferenceOption[] | null>(null);
  useEffect(() => {
    let live = true;
    load().then((o) => live && setOptions(o), () => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [load]);
  return options;
}

function ReferenceSelect({ label, noun, value, onChange, load, required, helper, error, disabled }: { label: string; noun: string; value: string | undefined; onChange: (v: string | undefined) => void; load: () => Promise<ReferenceOption[]>; required?: boolean; helper?: string; error?: string; disabled: boolean }) {
  const options = useOptions(load);
  if (!options) return <Spinner label={`Loading the ${noun}s`} />;
  if (options.length === 0)
    return (
      <FormField label={label} required={required} helper={`No ${noun}s are managed here yet, so this names the website's own ${noun} by its address (e.g. education).${helper ? ` ${helper}` : ""}`} error={error} disabled={disabled}>
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

/* Stories, by id, up to `max`, in the order chosen (related stories,
   /impact's stories). `except` leaves a story out (itself). */
export function StoriesField({ label, value, onChange, max, except, error, disabled }: { label: string; value: string[]; onChange: (ids: string[]) => void; max: number; except?: string; error?: string; disabled: boolean }) {
  const [stories, setStories] = useState<PickableRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    storiesApi
      .list({ pageSize: 100, sort: "updated" })
      .then(({ items }) => items.filter((v) => v.record.status !== "archived" && v.record.id !== except).map((v) => ({ id: v.record.id, title: v.record.title, status: v.record.status, live: v.live, detail: `/stories/${v.record.slug}` })))
      .then((list) => live && setStories(list), () => live && setStories([]));
    return () => {
      live = false;
    };
  }, [except]);
  const load = useCallback(() => Promise.resolve(stories ?? []), [stories]);
  if (!stories) return <Spinner label="Loading the stories" />;
  if (stories.length === 0)
    return (
      <FormField label={label} helper="No stories are managed here yet, so this names the website's own stories by id, separated by commas. Once stories are added under Stories, choose them here." error={error} disabled={disabled}>
        <Input value={value.join(", ")} onChange={(e) => onChange(e.target.value.split(/[\s,]+/).filter(Boolean))} />
      </FormField>
    );
  return <RecordPicker label={label} load={load} value={value} onChange={onChange} max={max} disabled={disabled} error={error} />;
}
