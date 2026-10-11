import { useCallback, useEffect, useState } from "react";
import { useCan } from "../../auth";
import { Alert, ArrowDown, ArrowUp, Badge, Button, Card, ChartBar, EmptyState, IconButton, PageContainer, PageHeader, Panel, Pencil, Plus, Select, Spinner } from "../../design-system";
import { metricsApi, type Metric } from "../../content/client";
import { statusBadge } from "../../content/editor";
import { useOrderedCollection } from "../../content/ordered";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "../../blocks/blocks.module.css";

/* /impact/figures — the headline figures (“50K+ Lives Impacted…”), in
   order. The homepage and the Impact page NAME figures by key; they never
   restate one, so a value changed here changes everywhere at the next
   publish. Move up / Move down save at once, revision-checked
   (content/ordered.ts). Until a figure is PUBLISHED here and an owner
   publishes the website, the website keeps its own figures. */

export default function MetricsPage() {
  const canCreate = useCan("content:create");
  const canEdit = useCan("content:update");
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const figures = useOrderedCollection<Metric>(metricsApi, (m) => `${m.value} ${m.label}`);
  const { items, failed, busy, conflict, move, position } = figures;
  const load = useCallback(async () => {
    await figures.load();
    publishApi.status().then(setPublish, () => {});
  }, [figures.load]);
  useEffect(() => void publishApi.status().then(setPublish, () => {}), []);

  if (failed) return <PageContainer><EmptyState title="The impact figures could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!items) return <PageContainer><Spinner label="Loading the impact figures" /></PageContainer>;

  const shown = items.filter((m) => (status ? m.record.status === status : m.record.status !== "archived"));
  const create = canCreate && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate("/impact/figures/new")}>
      New figure
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title="Impact figures" description="The headline figures, in order. The homepage and the Impact page name them; a figure is written once. Until one is published here, the website keeps its own figures." actions={create} />
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
      <div className={contentStyles.toolbar} role="search" aria-label="Impact figures">
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
          <EmptyState icon={ChartBar} title="No impact figures yet" description="Add the headline figures. Until one is published here, the website keeps its own." actions={create} />
        </Card>
      ) : (
        <Panel title="Figures" as="h2" description={`${shown.length} ${shown.length === 1 ? "figure" : "figures"}`}>
          {shown.length === 0 ? (
            <p className={styles.help}>No figures with this status.</p>
          ) : (
            <ol className={styles.blocks} aria-label="Impact figures, in order">
              {shown.map((m) => {
                const { index, count } = position(m);
                const movable = canEdit && !busy && m.record.status !== "archived" && !status;
                const name = `${m.record.value} ${m.record.label}`;
                return (
                  <li key={m.record.id} className={styles.block} data-ordered-id={m.record.id}>
                    <div className={styles.blockMain}>
                      <button type="button" className={styles.blockSelect} onClick={() => navigate(`/impact/figures/${m.record.id}`)}>
                        <span className={styles.blockTitle}>
                          {m.record.value} — {m.record.label}
                          {statusBadge(m.record.status, m.live, m.schedule)}
                          <Badge tone={m.record.verification === "verified" ? "success" : "warning"}>{m.record.verification === "verified" ? "Verified" : "Awaiting verification"}</Badge>
                        </span>
                        <span className={styles.blockSummary}>Key: {m.record.slug}</span>
                      </button>
                    </div>
                    <div className={styles.blockActions}>
                      <IconButton size="sm" label={`Move “${name}” up`} icon={<ArrowUp />} data-move="up" disabled={!movable || index <= 0} onClick={() => move(m, -1)} />
                      <IconButton size="sm" label={`Move “${name}” down`} icon={<ArrowDown />} data-move="down" disabled={!movable || index === -1 || index >= count - 1} onClick={() => move(m, 1)} />
                      <IconButton size="sm" label={`Edit “${name}”`} icon={<Pencil />} onClick={() => navigate(`/impact/figures/${m.record.id}`)} />
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
