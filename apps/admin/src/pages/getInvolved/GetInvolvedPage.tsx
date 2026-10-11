import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, HandHelping, PageContainer, PageHeader, Pencil, Table, TableBody, TableCell, TableHead, TableHeader, TableLoading, TableRow } from "../../design-system";
import { formatSchedule } from "../../content/workflow";
import { statusBadge } from "../../content/editor";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { getInvolvedApi, type GetInvolvedSummary } from "../../getInvolved/client";
import { rowOf } from "../../getInvolved/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "../policies/policies.module.css";

/* /get-involved — the website's five Get Involved pages (M20): the hub and
   the four ways to take part, always these five, at their fixed
   addresses. Each row says where it stands — not started, its status,
   whether a version is on the website, a schedule. A page the CMS has not
   published keeps the website's own words. */

export default function GetInvolvedPage() {
  const [pages, setPages] = useState<GetInvolvedSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [publish, setPublish] = useState<PublishStatus | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPages((await getInvolvedApi.list()).pages);
    } catch {
      setFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <PageContainer>
      <PageHeader
        title="Get Involved"
        description="The Get Involved page and the four ways to take part. Their words come from Rising Beyond Borders; until a page is published here, the website keeps its own words for it. Titles, addresses, icons, images and forms stay the website's."
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={false} onPublished={load} />
        </div>
      )}
      {failed ? (
        <EmptyState bordered icon={HandHelping} title="The Get Involved pages could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      ) : (
        <Table label="Get Involved pages" loading={!pages} data-testid="get-involved-table">
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>On the website</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead shrink>
                <span className="ds-visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!pages ? (
              <TableLoading colSpan={5} />
            ) : (
              pages.map((p) => {
                const row = rowOf(p.view);
                return (
                  <TableRow key={p.id} data-page-id={p.id}>
                    <TableCell>
                      <span className={styles.name}>{p.label}</span>
                      <span className={styles.route}>{p.route}</span>
                    </TableCell>
                    <TableCell data-status={row.status ?? "none"}>{row.exists ? statusBadge(p.view.record!.status, p.view.live, p.view.schedule) : <Badge size="sm">Not started</Badge>}</TableCell>
                    <TableCell data-live={row.live ? "yes" : "no"}>{row.live ? "A published version" : <span className={contentStyles.muted}>The website's own words</span>}</TableCell>
                    <TableCell muted>{row.scheduledAt ? formatSchedule(row.scheduledAt, p.view.schedule!.timeZone) : "—"}</TableCell>
                    <TableCell shrink>
                      <Button size="sm" variant="ghost" leadingIcon={<Pencil />} onClick={() => navigate(`/get-involved/${p.id}`)} aria-label={`${row.exists ? "Edit" : "Start"} the ${p.label}`}>
                        {row.exists ? "Edit" : "Start"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  );
}
