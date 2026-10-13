import { FORM_LABELS } from "../submissions/format.ts";

/* The topbar's notifications (2026-10-13): GET /api/v1/notifications, read
   live — nothing to mark read here. An entry goes away when the work is
   done: a submission opened, content approved, a change published. */

export interface ReviewItem {
  section: string;
  title: string;
}

export interface Notifications {
  submissions: { new: number; byForm: Record<string, number> } | null;
  publishing: {
    submitted: { total: number; items: ReviewItem[] };
    approved: { total: number; items: ReviewItem[] };
    failedSchedules: (ReviewItem & { at: string })[];
  } | null;
  canApprove: boolean;
  canPublish: boolean;
  checkedAt: string;
}

/* Where each section the API names is edited in the admin
   (PublishService #sections / #pages). Anything else: the publish panel. */
const SECTION_HREFS: Record<string, string> = {
  "News and blogs": "/posts",
  Events: "/events",
  Appeals: "/appeals",
  Team: "/team",
  Programs: "/programs",
  "Impact figures": "/impact/figures",
  "Transparency documents": "/transparency",
  Stories: "/stories",
  Projects: "/projects",
  "Donation page": "/donation-page",
  Homepage: "/homepage",
  "About page": "/about",
  "Impact page": "/impact",
  Transparency: "/transparency",
  "Careers page": "/careers",
  "How We Work page": "/how-we-work",
  "Announcement bar": "/announcements",
  Popup: "/popups",
  Highlights: "/highlights",
};
export const PUBLISH_HREF = "/settings";
/* Policies ("Privacy Policy", "Terms of Use", "Donation Policy") and the
   Get Involved pages ("Volunteer page" …) by their API labels' shape. */
export const sectionHref = (section: string): string =>
  SECTION_HREFS[section] ?? (/polic|terms of use/i.test(section) ? "/policies" : /get involved|volunteer|fellowship|partner|travel/i.test(section) ? "/get-involved" : PUBLISH_HREF);

export const itemLabel = (item: ReviewItem) => (item.title === item.section ? item.section : `${item.section}: ${item.title}`);

/* The number on the bell: what THIS person can act on. Editors see the
   publishing queue in the list, but only owners approve and publish. */
export function badgeCount(n: Notifications | null): number {
  if (!n) return 0;
  return (
    (n.submissions?.new ?? 0) +
    (n.publishing && n.canApprove ? n.publishing.submitted.total : 0) +
    (n.publishing && n.canPublish ? n.publishing.approved.total + n.publishing.failedSchedules.length : 0)
  );
}

/* New submissions per form — [["Contact Us", 1], ["Newsletter", 2]] — in
   the forms' usual order, every career form together as "Careers". */
export function formBreakdown(byForm: Record<string, number>): [string, number][] {
  const label = (id: string) => (Object.hasOwn(FORM_LABELS, id) ? FORM_LABELS[id]! : id.startsWith("career-") ? "Careers" : id);
  const order = [...Object.values(FORM_LABELS), "Careers"];
  const totals = new Map<string, number>();
  for (const [id, count] of Object.entries(byForm)) totals.set(label(id), (totals.get(label(id)) ?? 0) + count);
  return [...totals]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
