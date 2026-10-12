import { useState } from "react";
import { useCan } from "../../auth";
import { Alert, Checkbox, EmptyState, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { teamApi, type TeamMember } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { ItemList, ParagraphsField, TextField } from "../../blocks/fields";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import { TEAM_GROUPS } from "./groups";
import styles from "../../content/content.module.css";

/* One team member. Sections: basic information, profile, photograph,
   links, publishing. Only what the Our Team page and the profile draw; no
   contact details. A profile page (/about/team/<address>) exists only for
   someone with a biography. The address follows the name until edited by
   hand. Order is set on the team list. */

const FIELDS = ["name", "slug", "role", "group", "featured", "shortBio", "biography", "imageId", "departmentOrArea", "location", "socialLinks", "relatedLinks"] as const;

export default function TeamEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<TeamMember>({ api: teamApi, id: params.id!, base: "team", fields: FIELDS, initial: { group: "team", status: "draft" }, kind: "team member" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the team member" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This team member doesn't exist" : "The team member could not be loaded"} description="They may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const optional = (value: string) => (value === "" ? undefined : value);

  return (
    <PageContainer width="narrow">
      <PageHeader title={editor.view ? editor.view.record.name : "New team member"} eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)} description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "Someone on the Our Team page — with their consent."} />
      <EditorNotices editor={editor} kind="team member" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Name" required disabled={readOnly} error={err("name")}>
              <Input maxLength={120} value={d.name ?? ""} onChange={(e) => editor.set({ name: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Role" required helper="Their title or area, as it should appear." disabled={readOnly} error={err("role")}>
              <Input maxLength={120} value={d.role ?? ""} onChange={(e) => editor.set({ role: e.target.value })} />
            </FormField>
            <FormField label="Group" disabled={readOnly} error={err("group")}>
              <Select options={TEAM_GROUPS.map((g) => ({ value: g.id, label: g.label }))} value={d.group ?? "team"} onChange={(e) => editor.set({ group: e.target.value as TeamMember["group"] })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Unique across the team." disabled={readOnly} error={err("slug")}>
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
              /about/team/{d.slug || "…"}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <Checkbox label="Featured" description="Marks them for a featured-people section. The website does not show one today." checked={Boolean(d.featured)} disabled={readOnly} onChange={(e) => editor.set({ featured: e.target.checked || undefined })} />
          </div>
        </Panel>
        <Panel title="Profile" as="h2" description="A profile page exists only when there is a biography.">
          <div className={styles.fields}>
            <FormField label="Short bio" helper="Optional. One or two sentences for the team card." disabled={readOnly} error={err("shortBio")}>
              <Textarea rows={2} maxLength={300} value={d.shortBio ?? ""} onChange={(e) => editor.set({ shortBio: optional(e.target.value) })} />
            </FormField>
            {d.biography ? (
              <ParagraphsField label="Biography" helper="Separate paragraphs with a blank line. Clear it to remove the profile page." value={d.biography} onChange={(biography) => editor.set({ biography: biography.join("") === "" ? undefined : (biography as typeof d.biography) })} error={err("biography") ?? err("biography.0")} disabled={readOnly} />
            ) : (
              <Checkbox label="Give them a profile page" description="Adds a biography, shown on their own page." checked={false} disabled={readOnly} onChange={(e) => e.target.checked && editor.set({ biography: [""] as unknown as TeamMember["biography"] })} />
            )}
            <div className={styles.row}>
              <FormField label="Department or area" helper="Optional." disabled={readOnly} error={err("departmentOrArea")}>
                <Input maxLength={120} value={d.departmentOrArea ?? ""} onChange={(e) => editor.set({ departmentOrArea: optional(e.target.value) })} />
              </FormField>
              <FormField label="Location" helper="Optional — only if they agree to it being public." disabled={readOnly} error={err("location")}>
                <Input maxLength={120} value={d.location ?? ""} onChange={(e) => editor.set({ location: optional(e.target.value) })} />
              </FormField>
            </div>
          </div>
        </Panel>
        <Panel title="Photograph" as="h2">
          <MediaPicker label="Photograph" helper="Optional. Its alt text is the media library's — describe the photograph there." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
        </Panel>
        <Panel title="Links" as="h2" description="Shown on the profile page.">
          <div className={styles.fields}>
            <ItemList
              label="Social accounts"
              items={d.socialLinks ?? []}
              max={6}
              disabled={readOnly}
              error={err("socialLinks")}
              itemLabel={(i) => `Account ${i + 1}`}
              onChange={(items) => editor.set({ socialLinks: items.length ? items : undefined })}
              make={() => ({ label: "", url: "" })}
              render={(item, setItem, i) => (
                <div className={styles.row}>
                  <TextField label="Name" required helper="e.g. LinkedIn" max={60} value={item.label} onChange={(label) => setItem({ ...item, label: label ?? "" })} error={err(`socialLinks.${i}.label`)} disabled={readOnly} />
                  <TextField label="Address" required helper="An https:// link they approve." max={2048} value={item.url} onChange={(url) => setItem({ ...item, url: url ?? "" })} error={err(`socialLinks.${i}.url`)} disabled={readOnly} />
                </div>
              )}
            />
            <ItemList
              label="Related pages"
              items={d.relatedLinks ?? []}
              max={6}
              disabled={readOnly}
              error={err("relatedLinks")}
              itemLabel={(i) => `Page ${i + 1}`}
              onChange={(items) => editor.set({ relatedLinks: items.length ? items : undefined })}
              make={() => ({ label: "", href: "" })}
              render={(item, setItem, i) => (
                <div className={styles.row}>
                  <TextField label="Link text" required max={60} value={item.label} onChange={(label) => setItem({ ...item, label: label ?? "" })} error={err(`relatedLinks.${i}.label`)} disabled={readOnly} />
                  <TextField label="Page" required helper="A site path, e.g. /work or /about#transparency." max={300} value={item.href} onChange={(href) => setItem({ ...item, href: href ?? "" })} error={err(`relatedLinks.${i}.href`)} disabled={readOnly} />
                </div>
              )}
            />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="team member" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create them first; then submit them for review.</p>
            )}
            {!canEdit && <Alert tone="info">You can view this team member but not change them.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="team member" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
