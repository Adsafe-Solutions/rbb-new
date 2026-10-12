import { useCallback, useEffect, useState } from "react";
import { useCan } from "../../auth";
import { Alert, ArrowDown, ArrowUp, Badge, Button, Card, EmptyState, IconButton, PageContainer, PageHeader, Panel, Pencil, Plus, Select, Spinner, Users } from "../../design-system";
import { teamApi, type TeamMember } from "../../content/client";
import { useOrderedCollection } from "../../content/ordered";
import { statusBadge } from "../../content/editor";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { PublishPanel } from "../settings/PublishPanel";
import { TEAM_GROUPS } from "./groups";
import { isTemplate } from "./template";
import contentStyles from "../../content/content.module.css";
import styles from "../../blocks/blocks.module.css";

/* /team — the people on the website's Our Team page, by group, in team
   order. Move up / Move down change a member's place within their group
   (keyboard reachable; focus follows the moved member) and save at once:
   the whole order is sent with each member's revision, so a stale list is
   refused (Reload latest) rather than overwriting someone's edit.

   Real people only, with their consent: nothing here is sample data. A
   member reaches the website only once an owner marks them published and
   publishes the site.

   TEMPLATES: "New template" creates a member that is a role, not a person
   (a release marker is set in the very first save). A template can be
   edited, never submitted or published; an owner unmarks it to make it a
   real member. */

export default function TeamPage() {
  const canCreate = useCan("content:create");
  const canEdit = useCan("content:update");
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const team = useOrderedCollection<TeamMember>(teamApi, (m) => m.name, (a, b) => a.group === b.group);
  const { items: members, failed, busy, conflict, move, position } = team;
  const load = useCallback(async () => {
    await team.load();
    publishApi.status().then(setPublish, () => {});
  }, [team.load]);
  useEffect(() => void publishApi.status().then(setPublish, () => {}), []);

  if (failed) return <PageContainer><EmptyState title="The team could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} /></PageContainer>;
  if (!members) return <PageContainer><Spinner label="Loading the team" /></PageContainer>;

  const shown = members.filter((m) => (status ? m.record.status === status : m.record.status !== "archived"));

  const create = canCreate && (
    <>
      <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate("/team/new")}>
        New team member
      </Button>
      <Button leadingIcon={<Plus />} onClick={() => navigate("/team/new-template")}>
        New template
      </Button>
    </>
  );

  return (
    <PageContainer>
      <PageHeader title="Team" description="The people on the website's Our Team page, by group, in order. Each one needs their consent to appear." actions={create} />
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
      <div className={contentStyles.toolbar} role="search" aria-label="Team">
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
      {members.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No team members yet" description="Add the people who should appear on the Our Team page — with their consent. Until the first is added here, the website keeps its own team page." actions={create} />
        </Card>
      ) : (
        <div className={styles.fields}>
          {TEAM_GROUPS.map((group) => {
            const list = shown.filter((m) => m.record.group === group.id);
            return (
              <Panel key={group.id} title={group.label} as="h2" description={`${list.length} ${list.length === 1 ? "person" : "people"}`}>
                {list.length === 0 ? (
                  <p className={styles.help}>Nobody in this group{status ? " with this status" : ""}.</p>
                ) : (
                  <ol className={styles.blocks} aria-label={`${group.label}, in order`}>
                    {list.map((m) => {
                      const { index: at, count } = position(m);
                      const movable = canEdit && !busy && m.record.status !== "archived" && !status;
                      return (
                        <li key={m.record.id} className={styles.block} data-member-id={m.record.id} data-ordered-id={m.record.id}>
                          <div className={styles.blockMain}>
                            <button type="button" className={styles.blockSelect} onClick={() => navigate(`/team/${m.record.id}`)}>
                              <span className={styles.blockTitle}>
                                {m.record.name}
                                {statusBadge(m.record.status, m.live, m.schedule, isTemplate(m.record))}
                                {m.record.featured && <Badge>Featured</Badge>}
                              </span>
                              <span className={styles.blockSummary}>{m.record.role}</span>
                            </button>
                          </div>
                          <div className={styles.blockActions}>
                            <IconButton size="sm" label={`Move “${m.record.name}” up`} icon={<ArrowUp />} data-move="up" disabled={!movable || at <= 0} onClick={() => move(m, -1)} />
                            <IconButton size="sm" label={`Move “${m.record.name}” down`} icon={<ArrowDown />} data-move="down" disabled={!movable || at === -1 || at >= count - 1} onClick={() => move(m, 1)} />
                            <IconButton size="sm" label={`Edit “${m.record.name}”`} icon={<Pencil />} onClick={() => navigate(`/team/${m.record.id}`)} />
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
