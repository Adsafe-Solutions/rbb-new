import { useCallback, useEffect, useState } from "react";
import { useCan } from "../../auth";
import { Alert, ArrowDown, ArrowUp, Button, Card, EmptyState, IconButton, LayoutGrid, PageContainer, PageHeader, Panel, Pencil, Plus, Select, Spinner } from "../../design-system";
import { programsApi, type Program } from "../../content/client";
import { statusBadge } from "../../content/editor";
import { useOrderedCollection } from "../../content/ordered";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "../../blocks/blocks.module.css";

/* /programs — the organization's areas of work, in the order the website
   shows them (Our Work, the menu, the homepage's program cards). Move up /
   Move down save at once, revision-checked (content/ordered.ts). Until the
   first program is PUBLISHED here and an owner publishes the website, the
   website keeps its own program areas. */

export default function ProgramsPage() {
  const canCreate = useCan("content:create");
  const canEdit = useCan("content:update");
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const programs = useOrderedCollection<Program>(programsApi, (p) => p.title);
  const { items, failed, busy, conflict, move, position } = programs;
  const load = useCallback(async () => {
    await programs.load();
    publishApi.status().then(setPublish, () => {});
  }, [programs.load]);
  useEffect(() => void publishApi.status().then(setPublish, () => {}), []);

  if (failed) return <PageContainer><EmptyState title="The programs could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!items) return <PageContainer><Spinner label="Loading the programs" /></PageContainer>;

  const shown = items.filter((p) => (status ? p.record.status === status : p.record.status !== "archived"));
  const create = canCreate && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate("/programs/new")}>
      New program
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title="Programs" description="The areas of work, in the order the website shows them. Until a program is published here, the website keeps its own program areas." actions={create} />
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
      <div className={contentStyles.toolbar} role="search" aria-label="Programs">
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
          <EmptyState icon={LayoutGrid} title="No programs yet" description="Add the organization's areas of work. Until one is published here, the website keeps its own program areas." actions={create} />
        </Card>
      ) : (
        <Panel title="Areas of work" as="h2" description={`${shown.length} ${shown.length === 1 ? "program" : "programs"}`}>
          {shown.length === 0 ? (
            <p className={styles.help}>No programs with this status.</p>
          ) : (
            <ol className={styles.blocks} aria-label="Programs, in order">
              {shown.map((p) => {
                const { index, count } = position(p);
                const movable = canEdit && !busy && p.record.status !== "archived" && !status;
                return (
                  <li key={p.record.id} className={styles.block} data-ordered-id={p.record.id}>
                    <div className={styles.blockMain}>
                      <button type="button" className={styles.blockSelect} onClick={() => navigate(`/programs/${p.record.id}`)}>
                        <span className={styles.blockTitle}>
                          {p.record.title}
                          {statusBadge(p.record.status, p.live, p.schedule)}
                        </span>
                        <span className={styles.blockSummary}>/work/{p.record.slug} · {p.record.description}</span>
                      </button>
                    </div>
                    <div className={styles.blockActions}>
                      <IconButton size="sm" label={`Move “${p.record.title}” up`} icon={<ArrowUp />} data-move="up" disabled={!movable || index <= 0} onClick={() => move(p, -1)} />
                      <IconButton size="sm" label={`Move “${p.record.title}” down`} icon={<ArrowDown />} data-move="down" disabled={!movable || index === -1 || index >= count - 1} onClick={() => move(p, 1)} />
                      <IconButton size="sm" label={`Edit “${p.record.title}”`} icon={<Pencil />} onClick={() => navigate(`/programs/${p.record.id}`)} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}
    </PageContainer>
  );
}
