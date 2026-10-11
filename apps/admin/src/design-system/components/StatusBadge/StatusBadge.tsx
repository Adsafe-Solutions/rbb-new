import type { IconComponent } from "../../icons";
import { Archive, CalendarClock, CircleCheck, CircleDashed, CircleX, Clock, FileCheck, TriangleAlert } from "../../icons";
import { Badge, type BadgeTone } from "../Badge/Badge";

/* The fixed vocabulary of states. Each pairs a tone with an icon AND a
   word, so a status reads correctly without colour (WCAG 1.4.1) — in
   greyscale, to colour-blind users and to screen readers. */
export type Status = "draft" | "submitted" | "approved" | "published" | "archived" | "scheduled" | "pending" | "success" | "warning" | "error";

export const STATUS_PRESENTATION: Record<Status, { label: string; tone: BadgeTone; icon: IconComponent }> = {
  draft: { label: "Draft", tone: "neutral", icon: CircleDashed },
  submitted: { label: "Needs review", tone: "warning", icon: Clock },
  approved: { label: "Approved", tone: "info", icon: FileCheck },
  published: { label: "Published", tone: "success", icon: CircleCheck },
  archived: { label: "Archived", tone: "neutral", icon: Archive },
  scheduled: { label: "Scheduled", tone: "scheduled", icon: CalendarClock },
  pending: { label: "Pending", tone: "warning", icon: Clock },
  success: { label: "Success", tone: "success", icon: CircleCheck },
  warning: { label: "Warning", tone: "warning", icon: TriangleAlert },
  error: { label: "Error", tone: "danger", icon: CircleX },
};

export interface StatusBadgeProps {
  status: Status;
  /** Replaces the default word, e.g. "Failed" for an error. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, label, size, className }: StatusBadgeProps) {
  const { label: fallback, tone, icon: Icon } = STATUS_PRESENTATION[status];
  return (
    <Badge tone={tone} size={size} icon={<Icon />} className={className} data-status={status}>
      {label ?? fallback}
    </Badge>
  );
}
