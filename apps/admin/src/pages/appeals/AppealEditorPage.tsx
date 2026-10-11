import { useState } from "react";
import { useCan } from "../../auth";
import { PUBLIC_SITE_URL } from "../../config";
import { Alert, Checkbox, EmptyState, ExternalLink, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea } from "../../design-system";
import { appealsApi, type Appeal } from "../../content/client";
import { EditorNotices, EditorSaveBar, statusBadge, useContentEditor } from "../../content/editor";
import { WorkflowControls, isLocked } from "../../content/workflow";
import { CheckoutFields } from "../../donations/CheckoutFields";
import { DonationSections } from "../../donations/DonationSections";
import { MediaPicker } from "../../media/MediaPicker";
import type { PageProps } from "../../routes";
import { slugify } from "../posts/slug";
import styles from "../../content/content.module.css";
import { nextSeo } from "../../content/seo";
import { NoIndexField } from "../../content/NoIndexField";

/* One appeal. Sections: basic information, content, featured media,
   donation configuration, SEO, publishing. The address follows the title
   until it is edited by hand. Givebutter takes the gift; this configures
   which campaign and form, never any payment detail. */

const FIELDS = ["kind", "title", "slug", "summary", "startsOn", "endsOn", "highlight", "sections", "imageId", "donation", "seo"] as const;
const PATHS = { emergency: "/appeals/emergency/", campaign: "/appeals/campaigns/" } as const;

export default function AppealEditorPage({ params }: PageProps) {
  const canEdit = useCan(params.id === "new" ? "content:create" : "content:update");
  const canArchive = useCan("content:delete");
  const canApprove = useCan("content:approve");
  const editor = useContentEditor<Appeal>({ api: appealsApi, id: params.id!, base: "appeals", fields: FIELDS, initial: { kind: "emergency", status: "draft", sections: [] }, kind: "appeal" });
  const [slugTouched, setSlugTouched] = useState(params.id !== "new");
  const d = editor.draft;
  const err = (path: string) => editor.errors.get(path);
  const readOnly = !canEdit || isLocked(editor.view?.record.status);

  if (editor.status === "loading") return <PageContainer width="narrow"><Spinner label="Loading the appeal" /></PageContainer>;
  if (editor.status === "missing" || editor.status === "error")
    return (
      <PageContainer width="narrow">
        <EmptyState title={editor.status === "missing" ? "This appeal doesn't exist" : "The appeal could not be loaded"} description="It may have been removed, or the link is wrong." />
      </PageContainer>
    );

  const seo = d.seo ?? {};
  const setSeo = (changes: Partial<NonNullable<Appeal["seo"]>>) => {
    const next = nextSeo(seo, changes);
    editor.set({ seo: next });
  };
  const donation = d.donation ?? {};
  const setDonation = (changes: Partial<NonNullable<Appeal["donation"]>>) => {
    const next = Object.fromEntries(Object.entries({ ...donation, ...changes }).filter(([, v]) => v !== undefined && v !== ""));
    editor.set({ donation: Object.keys(next).length ? next : undefined });
  };
  const setHighlight = (changes: Partial<NonNullable<Appeal["highlight"]>>) =>
    editor.set({ highlight: Object.fromEntries(Object.entries({ ...(d.highlight ?? {}), ...changes }).filter(([, v]) => v !== undefined && v !== "")) });
  const path = `${PATHS[d.kind ?? "emergency"]}${d.slug || "…"}`;
  /* The working version is the one on the website (no pending changes). */
  const live = editor.view?.live && editor.view.record.status === "published";

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={editor.view ? editor.view.record.title : "New appeal"}
        eyebrow={editor.view && statusBadge(editor.view.record.status, editor.view.live, editor.view.schedule)}
        description={editor.view ? `Last edited ${new Date(editor.view.updatedAt).toLocaleString()} by ${editor.view.updatedBy.isYou ? "you" : editor.view.updatedBy.name}.` : "An emergency appeal or a campaign, with its own donation page."}
      />
      <EditorNotices editor={editor} kind="appeal" canEdit={canEdit} />
      <div className={styles.sections}>
        <Panel title="Basic information" as="h2">
          <div className={styles.fields}>
            <FormField label="Kind" disabled={readOnly} error={err("kind")}>
              <Select options={[{ value: "emergency", label: "Emergency appeal" }, { value: "campaign", label: "Campaign" }]} value={d.kind ?? "emergency"} onChange={(e) => editor.set({ kind: e.target.value as Appeal["kind"] })} />
            </FormField>
            <FormField label="Title" required disabled={readOnly} error={err("title")}>
              <Input maxLength={120} value={d.title ?? ""} onChange={(e) => editor.set({ title: e.target.value, ...(!slugTouched && { slug: slugify(e.target.value) }) })} />
            </FormField>
            <FormField label="Web address" helper="Lowercase words joined by hyphens. Unique across appeals." disabled={readOnly} error={err("slug")}>
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
              {path}
            </p>
            {editor.view && editor.view.previousSlugs.length > 0 && <p className={styles.muted}>Earlier addresses: {editor.view.previousSlugs.join(", ")}</p>}
            <FormField label="Summary" required helper="Shown under the title and on appeal cards." disabled={readOnly} error={err("summary")}>
              <Textarea rows={3} maxLength={400} value={d.summary ?? ""} onChange={(e) => editor.set({ summary: e.target.value })} />
            </FormField>
            <div className={styles.row}>
              <FormField label="Runs from" helper="Optional." disabled={readOnly} error={err("startsOn")}>
                <Input type="date" value={d.startsOn ?? ""} onChange={(e) => editor.set({ startsOn: e.target.value || undefined })} />
              </FormField>
              <FormField label="Runs until" helper="Optional. Not before the start." disabled={readOnly} error={err("endsOn")}>
                <Input type="date" value={d.endsOn ?? ""} onChange={(e) => editor.set({ endsOn: e.target.value || undefined })} />
              </FormField>
            </div>
            <Checkbox
              label="Feature in the story circles"
              description="Shows the appeal in the circles at the top of the website."
              checked={Boolean(d.highlight)}
              disabled={readOnly}
              onChange={(e) => editor.set({ highlight: e.target.checked ? {} : undefined })}
            />
            {d.highlight && (
              <FormField label="Circle label" helper="Optional. A shorter name for the circle; up to 40 characters." disabled={readOnly} error={err("highlight.label")}>
                <Input maxLength={40} value={d.highlight.label ?? ""} onChange={(e) => setHighlight({ label: e.target.value })} />
              </FormField>
            )}
          </div>
        </Panel>
        <Panel title="Content" as="h2" description="What the appeal's page says below its donation form.">
          <DonationSections value={d.sections ?? []} onChange={(sections) => editor.set({ sections })} disabled={readOnly} error={err} path="sections" noun="appeal" />
          {err("sections") && <Alert tone="danger">{err("sections")}</Alert>}
        </Panel>
        <Panel title="Featured media" as="h2">
          <div className={styles.fields}>
            <MediaPicker label="Featured image" helper="Required. Shown beside the donation form and on appeal cards." value={d.imageId} onChange={(imageId) => editor.set({ imageId })} disabled={readOnly} error={err("imageId")} />
            {d.highlight && <MediaPicker label="Story circle image" helper="Optional. Defaults to the featured image." value={d.highlight.imageId} onChange={(imageId) => setHighlight({ imageId })} disabled={readOnly} error={err("highlight.imageId")} />}
          </div>
        </Panel>
        <Panel title="Donation configuration" as="h2" description="Givebutter takes and processes every gift. Only public identifiers are stored here.">
          <div className={styles.fields}>
            <FormField label="Designation" helper="Optional, internal: what gifts to this appeal are for, e.g. flood-response. Never shown to donors." disabled={readOnly} error={err("donation.designation")}>
              <Input maxLength={80} value={donation.designation ?? ""} onChange={(e) => setDonation({ designation: e.target.value })} />
            </FormField>
            <CheckoutFields value={donation.checkout} onChange={(checkout) => setDonation({ checkout })} disabled={readOnly} error={err} path="donation.checkout" />
          </div>
        </Panel>
        <Panel title="SEO" as="h2" description="Leave empty to use the title, the summary and the site's defaults.">
          <div className={styles.fields}>
            <FormField label="SEO title" helper="Up to 70 characters." disabled={readOnly} error={err("seo.title")}>
              <Input maxLength={70} value={seo.title ?? ""} onChange={(e) => setSeo({ title: e.target.value })} />
            </FormField>
            <FormField label="SEO description" helper="Up to 200 characters." disabled={readOnly} error={err("seo.description")}>
              <Textarea rows={2} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ description: e.target.value })} />
            </FormField>
            <MediaPicker label="Social image" helper="Shown when the appeal is shared." value={seo.ogImageId} onChange={(ogImageId) => setSeo({ ogImageId })} disabled={readOnly} error={err("seo.ogImageId")} />
            <NoIndexField value={seo.noIndex} onChange={(noIndex) => setSeo({ noIndex })} disabled={readOnly} noun="appeal" />
          </div>
        </Panel>
        <Panel title="Publishing" as="h2">
          <div className={styles.fields}>
            {editor.view ? (
              <WorkflowControls status={editor.view.record.status} live={editor.view.live} noun="appeal" canEdit={canEdit} canApprove={canApprove} dirty={editor.dirty} busy={editor.acting} onAct={editor.act} publishedAt={editor.view.record.publishedAt} schedule={editor.view.schedule} onSchedule={editor.schedule} onUnschedule={editor.unschedule} onPublished={editor.reload} />
            ) : (
              <p className={styles.muted}>Create it first; then submit it for review.</p>
            )}
            {live && PUBLIC_SITE_URL && (
              <p>
                <a className={styles.titleLink} href={`${PUBLIC_SITE_URL}${PATHS[editor.view!.record.kind]}${editor.view!.record.slug}`} target="_blank" rel="noreferrer">
                  Open on the website <ExternalLink size={14} aria-hidden="true" />
                </a>{" "}
                <span className={styles.muted}>(as of the last site publish)</span>
              </p>
            )}
            {!canEdit && <Alert tone="info">You can view this appeal but not change it.</Alert>}
          </div>
        </Panel>
      </div>
      <EditorSaveBar editor={editor} kind="appeal" canEdit={canEdit} canArchive={canArchive} />
    </PageContainer>
  );
}
