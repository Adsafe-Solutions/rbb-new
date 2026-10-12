import { useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../api";
import { useCan } from "../auth";
import { Button, Dialog, FormField, Input, Select, StatusBadge, useToast } from "../design-system";
import { publishApi, type PublishStatus } from "../settings/client";
import type { ContentStatus, ScheduleInput, ScheduleView, WorkflowAction } from "./client";
import { actionsFor, badgeOf, explain, formatSchedule, type ReviewMove } from "./workflowRules";
import styles from "./content.module.css";

/* The editorial workflow (M14), as every editor shows it — one set of
   words and controls for posts, events, appeals, the donation page, the
   homepage, About, team, programs, figures, documents, Impact,
   Transparency, projects, stories and Careers. The rules (which moves,
   which words) are workflowRules.ts.

   M15: for an approved revision, owners (publish:execute) also see
   "Publish now" (the website publish, confirmed with what it takes),
   "Schedule" (a date, a time and an explicit IANA time zone — never the
   browser's) and, once scheduled, "Unschedule". The API decides; this
   only offers what it would accept, and shows what it says. */

export { ACTED, formatSchedule, isLocked, isReady, readinessWord } from "./workflowRules";

/* The status badge, live version and schedule included. */
export function workflowBadge(status: ContentStatus | undefined, live = false, schedule: ScheduleView | null = null, template = false) {
  const badge = badgeOf(status, live, schedule, template);
  return <StatusBadge status={badge.status} label={badge.label} />;
}

/* Every IANA zone the browser knows, plus current names some runtimes
   still list under an older one (Asia/Kolkata, Europe/Kyiv). */
const ZONES = (() => {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {}
  return [...new Set([...zones, "UTC", "Asia/Kolkata", "Europe/Kyiv", "America/Toronto", "America/New_York", "Europe/London"])].sort();
})();
const ZONE_KEY = "rbb.schedule.timeZone";
const rememberedZone = () => {
  try {
    return localStorage.getItem(ZONE_KEY) ?? "";
  } catch {
    return "";
  }
};
/* The wall-clock date and time of `at` in `timeZone`, for the form. */
const wallClock = (at: string, timeZone: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

export interface WorkflowProps {
  status: ContentStatus;
  live: boolean;
  noun: string;
  /* content:update — submit and withdraw. */
  canEdit: boolean;
  /* content:approve — approve and return to draft (owners). */
  canApprove: boolean;
  /* Unsaved edits: a transition acts on the SAVED revision. */
  dirty: boolean;
  busy: boolean;
  onAct: (action: WorkflowAction) => Promise<void>;
  publishedAt?: string;
  /* M15: the schedule, and what scheduling calls (owners). `onSchedule`
     resolves to an error to show in the dialog, or null when it worked. */
  schedule?: ScheduleView | null;
  onSchedule?: (input: ScheduleInput) => Promise<string | null>;
  onUnschedule?: () => Promise<void>;
  /* After "Publish now" published the website: reload what is on screen. */
  onPublished?: () => void;
  /* A template (release marker): never reviewed or published; owners may unmark it. */
  template?: boolean;
}

/* The state, what it means, and the moves this member may make. */
export function WorkflowControls({ status, live, noun, canEdit, canApprove, dirty, busy, onAct, publishedAt, schedule = null, onSchedule, onUnschedule, onPublished, template = false }: WorkflowProps) {
  const canPublish = useCan("publish:execute") && Boolean(onSchedule);
  const [confirm, setConfirm] = useState<"approve" | "reject" | "schedule" | "unschedule" | "publish" | "unmark" | null>(null);
  const actions = actionsFor(status, canEdit, canApprove, { canPublish, schedule, template });
  const run = (action: ReviewMove) => (action === "submit" || action === "withdraw" ? void onAct(action) : setConfirm(action));

  return (
    <div className={styles.workflow} data-testid="workflow">
      <p className={styles.workflowState}>
        <span>Status:</span> {workflowBadge(status, live, schedule, template)}
      </p>
      {status === "approved" && schedule && (
        <p className={styles.workflowSchedule} data-testid="workflow-schedule">
          {schedule.failedAt ? "Was scheduled for" : "Scheduled for"} <strong>{formatSchedule(schedule.at, schedule.timeZone)}</strong>
        </p>
      )}
      <p className={styles.muted} data-testid="workflow-explain">
        {explain(status, live, noun, canApprove, schedule, template)}
      </p>
      {schedule?.failedAt && schedule.problems && schedule.problems.length > 0 && (
        <ul className={styles.workflowProblems} aria-label="Why the scheduled publication was refused">
          {schedule.problems.map((p) => (
            <li key={p}>{p.replace(/^(snapshot\.|settings\.)+/, "")}</li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <div className={styles.workflowActions}>
          {actions.map((a) => (
            <Button key={a.action} variant={a.primary ? "primary" : "secondary"} disabled={dirty || busy} loading={busy && confirm === null && a.primary} onClick={() => run(a.action)}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
      {dirty && actions.length > 0 && <p className={styles.muted}>Save your changes first — review acts on the saved version.</p>}
      {status === "approved" && !canPublish && <p className={styles.muted}>{schedule ? "An owner scheduled its publication." : "An owner publishes the website to put it live."}</p>}
      {publishedAt && <p className={styles.muted}>First published {new Date(publishedAt).toLocaleString()}.</p>}
      <Dialog
        open={confirm === "unmark"}
        onClose={() => setConfirm(null)}
        size="sm"
        title="Unmark this template?"
        description={`This turns the template into a real ${noun}'s record. It stays a draft — nothing is submitted, approved or published — and the template note is removed. Only do this for a real person, with their consent.`}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                await onAct("unmark");
                setConfirm(null);
              }}
            >
              Unmark template
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === "approve"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Approve this ${noun}?`}
        description="This exact version goes live at the next website publish. Approving checks its images and links again."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                await onAct("approve");
                setConfirm(null);
              }}
            >
              Approve
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === "reject"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Return this ${noun} to draft?`}
        description={
          (live ? "It leaves the review queue. The website keeps showing the last published version." : "It leaves the review queue and will not be in the next publish.") + (schedule ? " Its scheduled publication is cancelled." : "")
        }
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                await onAct("reject");
                setConfirm(null);
              }}
            >
              Return to draft
            </Button>
          </>
        }
      />
      {onSchedule && <ScheduleDialog open={confirm === "schedule"} noun={noun} schedule={schedule} busy={busy} onClose={() => setConfirm(null)} onSchedule={onSchedule} />}
      <Dialog
        open={confirm === "unschedule"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Unschedule this ${noun}?`}
        description={`It stays approved, and is no longer queued for ${schedule ? formatSchedule(schedule.at, schedule.timeZone) : "its scheduled time"}. It goes live with the next website publish an owner makes, unless it is scheduled again.`}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Keep the schedule</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                await onUnschedule?.();
                setConfirm(null);
              }}
            >
              Unschedule
            </Button>
          </>
        }
      />
      <PublishNowDialog open={confirm === "publish"} onClose={() => setConfirm(null)} onPublished={() => onPublished?.()} />
    </div>
  );
}

/* M15: choose WHEN — a date, a time and an IANA time zone. The zone is
   chosen, never assumed (the last one used is remembered on this device). */
function ScheduleDialog({ open, noun, schedule, busy, onClose, onSchedule }: { open: boolean; noun: string; schedule: ScheduleView | null; busy: boolean; onClose: () => void; onSchedule: (input: ScheduleInput) => Promise<string | null> }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const zone = schedule?.timeZone ?? rememberedZone();
    const current = schedule && zone ? wallClock(schedule.at, zone) : { date: "", time: "" };
    setDate(current.date);
    setTime(current.time);
    setTimeZone(ZONES.includes(zone) ? zone : "");
    setError(null);
  }, [open, schedule]);
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && Boolean(timeZone);
  const options = useMemo(() => ZONES.map((z) => ({ value: z, label: z.replace(/_/g, " ") })), []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={schedule?.failedAt ? `Reschedule this ${noun}` : `Schedule this ${noun}`}
      description="Choose when the website publishes this approved version. It is not public before then."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!ready}
            onClick={async () => {
              const problem = await onSchedule({ localTime: `${date}T${time}`, timeZone });
              if (problem) return setError(problem);
              try {
                localStorage.setItem(ZONE_KEY, timeZone);
              } catch {}
              onClose();
            }}
          >
            Schedule
          </Button>
        </>
      }
    >
      <div className={styles.scheduleFields}>
        <FormField label="Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Time" required>
          <Input type="time" step={60} value={time} onChange={(e) => setTime(e.target.value)} />
        </FormField>
        <FormField label="Time zone" required helper="The date and time are in this zone — not your browser's." error={error ?? undefined}>
          <Select placeholder="Choose a time zone" options={options} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
        </FormField>
      </div>
      {ready && (
        <p className={styles.muted} data-testid="schedule-preview">
          Publishes on {date} at {time}, {timeZone} time.
        </p>
      )}
    </Dialog>
  );
}

/* M15: "Publish now" — the website publish, confirmed with what it takes
   (everything approved and due, not only this record). */
function PublishNowDialog({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setError(null);
    publishApi.status().then(setStatus, () => setError("The publish status could not be loaded."));
  }, [open]);
  const blocked = Boolean(status?.blockers.length);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Publish the website now?"
      description="The saved settings and everything approved — not only this — become the public version of the website."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!status || blocked || !status.hasUnpublishedChanges}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await publishApi.publish(status!.changesKey);
                toast({ title: `Published version ${result.version}`, description: "The website will use it at its next build.", tone: "success" });
                onClose();
                onPublished();
              } catch (caught) {
                setError(caught instanceof ApiRequestError ? caught.message : "The website could not be published. Try again.");
                if (caught instanceof ApiRequestError && caught.status === 409) publishApi.status().then(setStatus, () => {});
              } finally {
                setBusy(false);
              }
            }}
          >
            Publish now
          </Button>
        </>
      }
    >
      {!status && !error && <p className={styles.muted}>Loading what would be published…</p>}
      {status && (
        <div className={styles.workflow}>
          <p className={styles.muted}>
            {status.review.totals.approved} approved item{status.review.totals.approved === 1 ? "" : "s"} will be published
            {status.review.totals.scheduled > 0 ? `; ${status.review.totals.scheduled} scheduled for later stay queued` : ""}
            {status.review.totals.submitted > 0 ? `; ${status.review.totals.submitted} waiting for review stay unpublished` : ""}.
          </p>
          {status.review.approved.length > 0 && (
            <ul className={styles.workflowProblems} aria-label="Approved content in this publish">
              {status.review.approved.slice(0, 6).map((i, n) => (
                <li key={`${i.section}-${i.title}-${n}`}>
                  {i.section}: {i.title}
                </li>
              ))}
            </ul>
          )}
          {blocked && <p className={styles.problem}>Something must be fixed first: {status.blockers[0]!.replace(/^(snapshot\.|settings\.)+/, "")}</p>}
        </div>
      )}
      {error && (
        <p className={styles.problem} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
