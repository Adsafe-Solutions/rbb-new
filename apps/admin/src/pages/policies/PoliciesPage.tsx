import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, FileText, PageContainer, PageHeader, Pencil, Table, TableBody, TableCell, TableHead, TableHeader, TableLoading, TableRow } from "../../design-system";
import { formatSchedule } from "../../content/workflow";
import { statusBadge } from "../../content/editor";
import { navigate } from "../../router";
import { publishApi, type PublishStatus } from "../../settings/client";
import { policiesApi, type PolicySummary } from "../../policies/client";
import { rowOf } from "../../policies/rules";
import { PublishPanel } from "../settings/PublishPanel";
import contentStyles from "../../content/content.module.css";
import styles from "./policies.module.css";

/* /policies — the website's three policies (M19): Privacy Policy, Terms
   of Use and Donation Policy, always these three, at their fixed
   addresses. Each row says where it stands — not started, its status,
   whether a version is on the website, a schedule, RBB's effective date.
   A policy the CMS has not published keeps the website's own record. */

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicySummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [publish, setPublish] = useState<PublishStatus | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPolicies((await policiesApi.list()).policies);
    } catch {
      setFailed(true);
    }
    publishApi.status().then(setPublish, () => {});
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <PageContainer>
      <PageHeader
        title="Policies"
        description="The website's Privacy Policy, Terms of Use and Donation Policy. Their text and dates come from Rising Beyond Borders and its counsel; until a policy is published here, the website keeps its own page for it."
      />
      {publish?.settingsReady && (
        <div className={contentStyles.publish}>
          <PublishPanel status={publish} unsaved={false} onPublished={load} />
        </div>
      )}
      {failed ? (
        <EmptyState bordered icon={FileText} title="The policies could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      ) : (
        <Table label="Policies" loading={!policies} data-testid="policies-table">
          <TableHeader>
            <TableRow>
              <TableHead>Policy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>On the website</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Effective date</TableHead>
              <TableHead shrink>
                <span className="ds-visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!policies ? (
              <TableLoading colSpan={6} />
            ) : (
              policies.map((p) => {
                const row = rowOf(p.view);
                return (
                  <TableRow key={p.id} data-policy-id={p.id}>
                    <TableCell>
                      <span className={styles.name}>{p.label}</span>
                      <span className={styles.route}>{p.route}</span>
                    </TableCell>
                    <TableCell data-status={row.status ?? "none"}>{row.exists ? statusBadge(p.view.record!.status, p.view.live, p.view.schedule) : <Badge size="sm">Not started</Badge>}</TableCell>
                    <TableCell data-live={row.live ? "yes" : "no"}>{row.live ? "A published version" : <span className={contentStyles.muted}>The website's own page</span>}</TableCell>
                    <TableCell muted>{row.scheduledAt ? formatSchedule(row.scheduledAt, p.view.schedule!.timeZone) : "—"}</TableCell>
                    <TableCell mono>{row.effectiveDate ?? <span className={contentStyles.muted}>Not set</span>}</TableCell>
                    <TableCell shrink>
                      <Button size="sm" variant="ghost" leadingIcon={<Pencil />} onClick={() => navigate(`/policies/${p.id}`)} aria-label={`${row.exists ? "Edit" : "Start"} the ${p.label}`}>
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
