import { useCallback, useEffect, useState } from "react";
import { useCan } from "../../auth";
import { Alert, ArrowDown, ArrowUp, Button, Card, EmptyState, FileCheck, IconButton, Landmark, PageContainer, PageHeader, Panel, Pencil, Plus, Select, Spinner } from "../../design-system";
import { reportsApi, type Report } from "../../content/client";
import { statusBadge } from "../../content/editor";
import { useOrderedCollection } from "../../content/ordered";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { REPORT_CATEGORIES } from "../../transparency/categories";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "../../blocks/blocks.module.css";

/* /transparency/documents — annual reports, financial information and
   governance documents, each list in the order the About page's
   Transparency chapter shows it. Move up / Move down change a document's
   place within its list and save at once, revision-checked
   (content/ordered.ts). A document is an https:// link to where the
   organization publishes the file — never a placeholder. Only PUBLISHED
   documents are listed on the website, after an owner publishes it. */

export default function ReportsPage() {
  const canCreate = useCan("content:create");
  const canEdit = useCan("content:update");
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const docs = useOrderedCollection<Report>(reportsApi, (r) => r.title, (a, b) => a.category === b.category);
  const { items, failed, busy, conflict, move, position } = docs;
  const load = useCallback(async () => {
    await docs.load();
    publishApi.status().then(setPublish, () => {});
  }, [docs.load]);
  useEffect(() => void publishApi.status().then(setPublish, () => {}), []);

  if (failed) return <PageContainer><EmptyState title="The documents could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!items) return <PageContainer><Spinner label="Loading the documents" /></PageContainer>;

  const shown = items.filter((r) => (status ? r.record.status === status : r.record.status !== "archived"));
  const create = canCreate && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate("/transparency/documents/new")}>
      New document
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Transparency documents"
        description="Annual reports, financial information and governance documents, each list in order. Only published documents with a real file are listed on the website."
        actions={
          <>
            <Button leadingIcon={<Landmark />} onClick={() => navigate("/transparency")}>
              Transparency
            </Button>
            {create}
          </>
        }
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={false} onPublished={load} />
        </div>
      )}
      {conflict && (
        <Alert tone="warning" role="alert" title="Changed elsewhere" className={contentStyles.notice}>
          {conflict}
          <span className={contentStyles.inlineAction}>
            <Button size="sm" onClick={load}>
              Reload latest
            </Button>
          </span>
        </Alert>
      )}
      <div className={contentStyles.toolbar} role="search" aria-label="Documents">
        <Select
          aria-label="Status"
          options={[
            { value: "", label: "Current (not archived)" },
            { value: "draft", label: "Draft" },
            { value: "submitted", label: "Needs review" },
            { value: "approved", label: "Approved" },
            { value: "published", label: "Published" },
            { value: "archived", label: "Archived" },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={FileCheck} title="No documents yet" description="Add a document once the organization has published the file itself. Nothing is listed on the website without one." actions={create} />
        </Card>
      ) : (
        <div className={styles.fields}>
          {REPORT_CATEGORIES.map((category) => {
            const list = shown.filter((r) => r.record.category === category.id);
            return (
              <Panel key={category.id} title={category.label} as="h2" description={`${list.length} ${list.length === 1 ? "document" : "documents"}`}>
                {list.length === 0 ? (
                  <p className={styles.help}>No documents in this list{status ? " with this status" : ""}.</p>
                ) : (
                  <ol className={styles.blocks} aria-label={`${category.label}, in order`}>
                    {list.map((r) => {
                      const { index, count } = position(r);
                      const movable = canEdit && !busy && r.record.status !== "archived" && !status;
                      return (
                        <li key={r.record.id} className={styles.block} data-ordered-id={r.record.id}>
                          <div className={styles.blockMain}>
                            <button type="button" className={styles.blockSelect} onClick={() => navigate(`/transparency/documents/${r.record.id}`)}>
                              <span className={styles.blockTitle}>
                                {r.record.title}
                                {statusBadge(r.record.status, r.live, r.schedule)}
                              </span>
                              <span className={styles.blockSummary}>{[r.record.type, r.record.year, r.record.fileUrl].filter(Boolean).join(" · ")}</span>
                            </button>
                          </div>
                          <div className={styles.blockActions}>
                            <IconButton size="sm" label={`Move “${r.record.title}” up`} icon={<ArrowUp />} data-move="up" disabled={!movable || index <= 0} onClick={() => move(r, -1)} />
                            <IconButton size="sm" label={`Move “${r.record.title}” down`} icon={<ArrowDown />} data-move="down" disabled={!movable || index === -1 || index >= count - 1} onClick={() => move(r, 1)} />
                            <IconButton size="sm" label={`Edit “${r.record.title}”`} icon={<Pencil />} onClick={() => navigate(`/transparency/documents/${r.record.id}`)} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
