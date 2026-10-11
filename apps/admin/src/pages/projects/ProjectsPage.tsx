import { useCallback, useEffect, useState } from "react";
import { useCan } from "../../auth";
import { Alert, ArrowDown, ArrowUp, Badge, Button, Card, EmptyState, FolderKanban, IconButton, PageContainer, PageHeader, Panel, Pencil, Plus, Select, Spinner } from "../../design-system";
import { projectsApi, type Project } from "../../content/client";
import { statusBadge } from "../../content/editor";
import { useOrderedCollection } from "../../content/ordered";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "../../blocks/blocks.module.css";

/* /projects — the projects, in the order the website lists them
   (/work/projects, each program's page, the homepage's project cards).
   Move up / Move down save at once, revision-checked (content/ordered.ts).
   Until a project is PUBLISHED here and an owner publishes the website,
   the website keeps its own projects. */

export default function ProjectsPage() {
  const canCreate = useCan("content:create");
  const canEdit = useCan("content:update");
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const projects = useOrderedCollection<Project>(projectsApi, (p) => p.title);
  const { items, failed, busy, conflict, move, position } = projects;
  const load = useCallback(async () => {
    await projects.load();
    publishApi.status().then(setPublish, () => {});
  }, [projects.load]);
  useEffect(() => void publishApi.status().then(setPublish, () => {}), []);

  if (failed) return <PageContainer><EmptyState title="The projects could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!items) return <PageContainer><Spinner label="Loading the projects" /></PageContainer>;

  const shown = items.filter((p) => (status ? p.record.status === status : p.record.status !== "archived"));
  const create = canCreate && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate("/projects/new")}>
      New project
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title="Projects" description="The projects, in the order the website lists them, each in a program area. Until a project is published here, the website keeps its own projects." actions={create} />
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
      <div className={contentStyles.toolbar} role="search" aria-label="Projects">
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
          <EmptyState icon={FolderKanban} title="No projects yet" description="Add the organization's approved projects. Until one is published here, the website keeps its own." actions={create} />
        </Card>
      ) : (
        <Panel title="Projects" as="h2" description={`${shown.length} ${shown.length === 1 ? "project" : "projects"}`}>
          {shown.length === 0 ? (
            <p className={styles.help}>No projects with this status.</p>
          ) : (
            <ol className={styles.blocks} aria-label="Projects, in order">
              {shown.map((p) => {
                const { index, count } = position(p);
                const movable = canEdit && !busy && p.record.status !== "archived" && !status;
                return (
                  <li key={p.record.id} className={styles.block} data-ordered-id={p.record.id}>
                    <div className={styles.blockMain}>
                      <button type="button" className={styles.blockSelect} onClick={() => navigate(`/projects/${p.record.id}`)}>
                        <span className={styles.blockTitle}>
                          {p.record.title}
                          {statusBadge(p.record.status, p.live, p.schedule)}
                          {p.record.featured && <Badge>Featured</Badge>}
                        </span>
                        <span className={styles.blockSummary}>
                          /work/projects/{p.record.slug} · {p.record.programId}
                        </span>
                      </button>
                    </div>
                    <div className={styles.blockActions}>
                      <IconButton size="sm" label={`Move “${p.record.title}” up`} icon={<ArrowUp />} data-move="up" disabled={!movable || index <= 0} onClick={() => move(p, -1)} />
                      <IconButton size="sm" label={`Move “${p.record.title}” down`} icon={<ArrowDown />} data-move="down" disabled={!movable || index === -1 || index >= count - 1} onClick={() => move(p, 1)} />
                      <IconButton size="sm" label={`Edit “${p.record.title}”`} icon={<Pencil />} onClick={() => navigate(`/projects/${p.record.id}`)} />
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
