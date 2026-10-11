/* Milestone 4: an event's schedule and time zone, as the editor handles
   them. The contract (packages/content-schema events/event.ts) is the
   rule; these mirror it so a problem shows beside the step before saving,
   and the API checks it again.

   Times stay wall-clock values ("6:30 PM") on the event's own day — never
   converted. The time zone is the editor's choice, never the browser's:
   nothing here reads the browser's own zone. */

export interface ScheduleStep {
  time?: string;
  item: string;
}

export const SCHEDULE_MAX = 20;

/* "6:30 PM" → minutes after midnight; anything else → NaN. */
export const minutesOf = (time: string | undefined): number => {
  const m = /^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/.exec(time ?? "");
  if (!m) return NaN;
  return ((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]);
};

/* What would be refused, per step (by index) and per field: a timed step
   falls within the event and timed steps run in order; every step has a
   line. */
export function scheduleProblems(startTime: string | undefined, endTime: string | undefined, schedule: readonly ScheduleStep[]): Map<number, { time?: string; item?: string }> {
  const problems = new Map<number, { time?: string; item?: string }>();
  const start = minutesOf(startTime);
  const end = endTime ? minutesOf(endTime) : NaN;
  let previous = Number.isFinite(start) ? start : -Infinity;
  schedule.forEach((step, i) => {
    const found: { time?: string; item?: string } = {};
    if (!step.item.trim()) found.item = "Describe this step.";
    if (step.time) {
      const at = minutesOf(step.time);
      if (Number.isFinite(start) && at < start) found.time = "Before the event starts.";
      else if (Number.isFinite(end) && at > end) found.time = "After the event ends.";
      else if (at < previous) found.time = "Before the step above it.";
      previous = Math.max(previous, at);
    }
    if (found.time || found.item) problems.set(i, found);
  });
  return problems;
}

/* The zones offered: the runtime's IANA list plus UTC, and the event's own
   zone when the list spells it differently ("Asia/Kolkata" where the list
   has "Asia/Calcutta") — a stored zone is always shown as it is. */
export function zoneOptions(current: string | undefined, supported: readonly string[]): { value: string; label: string }[] {
  const zones = [...new Set([...supported, "UTC", ...(current ? [current] : [])])].sort();
  return [{ value: "", label: "Choose a time zone" }, ...zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))];
}
