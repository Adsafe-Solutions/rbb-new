import { useState } from "react";
import { Badge, Button, CircleCheck, Dialog, Surface, TriangleAlert, useToast } from "../../design-system";
import { publishApi, type PublishStatus, type ReviewItem, type ScheduledItem } from "../../settings/client";
import { formatSchedule } from "../../content/workflowRules";
import { ApiRequestError } from "../../api";
import styles from "./SettingsPage.module.css";

const SECTION_LABELS: Record<string, string> = {
  general: "General", branding: "Branding", contact: "Contact", social: "Social", seo: "SEO",
  analytics: "Analytics", donations: "Donations", engagement: "Engagement", features: "Features",
  news: "News", blogs: "Blogs", events: "Events", appeals: "Appeals", generalDonation: "Donation page", homepage: "Homepage", about: "About page", team: "Team", programs: "Programs", metrics: "Impact figures", impact: "Impact page", transparency: "Transparency", reports: "Transparency documents", stories: "Stories", projects: "Projects", careers: "Careers page",
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/* What is live, whether the saved settings differ from it, and — for
   owners — the Publish action. Publishing takes the SAVED settings and
   the APPROVED content (M14): the panel lists what the next publish takes,
   what is still waiting for review (not taken), and anything that would
   stop it. The publish names the status it was reviewed from; if what
   would be published changed since, the API refuses (409) and the panel
   reloads. */

const SHOWN = 6;
function ItemList({ items, total, label }: { items: ReviewItem[]; total: number; label: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={styles.reviewHeading}>{label}</p>
      <ul className={styles.reviewList} aria-label={label}>
        {items.slice(0, SHOWN).map((i, n) => (
          <li key={`${i.section}-${i.title}-${n}`}>
            <span className={styles.muted}>{i.section}:</span> {i.title}
          </li>
        ))}
        {total > SHOWN && <li className={styles.muted}>and {total - SHOWN} more</li>}
      </ul>
    </div>
  );
}

/* M15: what is queued for later — when, in its own zone; a failed one says so. */
function ScheduledList({ items, total }: { items: ScheduledItem[]; total: number }) {
  if (!items.length) return null;
  const label = "Scheduled — publishes at its time";
  return (
    <div>
      <p className={styles.reviewHeading}>{label}</p>
      <ul className={styles.reviewList} aria-label={label}>
        {items.slice(0, SHOWN).map((i, n) => (
          <li key={`${i.section}-${i.title}-${n}`}>
            <span className={styles.muted}>{i.section}:</span> {i.title} — {formatSchedule(i.at, i.timeZone)}
            {i.failed && <strong className={styles.error}> (refused — needs an owner)</strong>}
          </li>
        ))}
        {total > SHOWN && <li className={styles.muted}>and {total - SHOWN} more</li>}
      </ul>
    </div>
  );
}
export function PublishPanel({ status, unsaved, onPublished }: { status: PublishStatus; unsaved: boolean; onPublished: () => void }) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = status.changedSections.map((s) => SECTION_LABELS[s] ?? s);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const result = await publishApi.publish(status.changesKey);
      setConfirm(false);
      toast({
        title: `Published version ${result.version}`,
        description: result.deployment.status === "triggered" ? "The website is rebuilding with these changes." : result.deployment.status === "failed" ? "The website rebuild could not be started; it will use these changes at its next build." : "The website will use these changes at its next build.",
        tone: "success",
      });
      onPublished();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError && caught.status === 400
          ? `These changes can't be published yet — ${caught.details.map((d) => `${d.path.replace(/^(snapshot\.|settings\.)+/, "")}: ${d.message}`).join("; ")}. Fix them and save first. The live website is unchanged.`
          : caught instanceof ApiRequestError && caught.status === 409
            ? caught.message
            : "The changes could not be published. Try again."
      );
      setConfirm(false);
      // A stale review: show the current queue.
      if (caught instanceof ApiRequestError && caught.status === 409) onPublished();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface bordered padding="md" className={styles.publish} data-testid="publish-panel">
      <div className={styles.publishText}>
        <p className={styles.publishTitle}>
          {status.active ? `Live: version ${status.active.version}` : "Not published yet"}
          {status.hasUnpublishedChanges ? (
            <Badge tone="warning" icon={<TriangleAlert />} data-testid="publish-state">
              Unpublished changes
            </Badge>
          ) : (
            <Badge tone="success" icon={<CircleCheck />} data-testid="publish-state">
              Up to date
            </Badge>
          )}
        </p>
        <p className={styles.muted}>
          {status.active ? `Published ${when(status.active.publishedAt)} by ${status.active.publishedBy}.` : "The website uses its built-in settings until these are published."}
          {status.hasUnpublishedChanges && changes.length > 0 && ` Changed since then: ${changes.join(", ")}.`}
        </p>
        <ItemList items={status.review.approved} total={status.review.totals.approved} label="Now — approved, goes live at the next publish" />
        <ScheduledList items={status.review.scheduled} total={status.review.totals.scheduled} />
        <ItemList items={status.review.submitted} total={status.review.totals.submitted} label="Waiting for review — not published until approved" />
        {status.active?.deployment?.status === "failed" && (
          <p className={styles.error} data-testid="deployment-failed">
            The website rebuild for version {status.active.version} could not be started ({status.active.deployment.attempts} attempt{status.active.deployment.attempts === 1 ? "" : "s"}). The snapshot is live; the scheduler tries again.
          </p>
        )}
        {status.blockers.length > 0 && (
          <div className={styles.blockers} data-testid="publish-blockers">
            <p className={styles.reviewHeading}>Blocked — must be fixed before publishing</p>
            <ul className={styles.reviewList}>
              {status.blockers.slice(0, SHOWN).map((b) => (
                <li key={b}>{b.replace(/^(snapshot\.|settings\.)+/, "")}</li>
              ))}
              {status.blockers.length > SHOWN && <li>and {status.blockers.length - SHOWN} more</li>}
            </ul>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className={styles.publishAction}>
        {status.canPublish ? (
          <>
            <Button variant="primary" onClick={() => setConfirm(true)} disabled={unsaved || !status.hasUnpublishedChanges || status.blockers.length > 0}>
              Publish changes
            </Button>
            {unsaved && <span className={styles.muted}>Save your changes before publishing.</span>}
            {!unsaved && status.blockers.length > 0 && <span className={styles.muted}>Fix the problems listed first.</span>}
          </>
        ) : (
          <span className={styles.muted}>Only an owner can publish website changes.</span>
        )}
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Publish changes?"
        description="The saved settings and the approved content will become the public version of the website."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={publish}>
              Publish
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          {changes.length ? `Sections: ${changes.join(", ")}.` : null} {status.deployment.configured ? "The website will rebuild automatically." : "The website shows them after its next build."}
        </p>
        <ItemList items={status.review.approved} total={status.review.totals.approved} label="Approved content in this publish" />
        {status.review.totals.scheduled > 0 && <p className={styles.muted}>{status.review.totals.scheduled} scheduled item{status.review.totals.scheduled === 1 ? " stays" : "s stay"} queued for {status.review.totals.scheduled === 1 ? "its" : "their"} time.</p>}
        {status.review.totals.submitted > 0 && <p className={styles.muted}>{status.review.totals.submitted} item{status.review.totals.submitted === 1 ? " is" : "s are"} still waiting for review and will not be published.</p>}
      </Dialog>
    </Surface>
  );
}
