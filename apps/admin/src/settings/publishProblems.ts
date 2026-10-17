/* What a website-publish problem means for the person fixing it: WHERE in
   the admin, with a link, and the message itself.

   The API reports each problem as "<data path>: <message>", e.g.
     "snapshot.content.impact.sections.5.data.storyIds.0: refers to story
      "classroom-books", which is not published"
     "schedule.Team.3f2c…: no longer matches the approved revision …"
     "content.policies.privacy.sections.2: contains working-placeholder text"
   — exact, but a path into the snapshot, not a page of the admin. This turns
   it into "Impact page · block 6" → /impact, "Team" → /team/3f2c…, and so
   on. Plain functions, unit-tested (scripts/test). A path it does not know
   still shows, as before, without a link. */

export interface PublishProblem {
  /* Where to fix it, in the admin's own words ("Impact page · block 6"). */
  where: string | null;
  /* The admin page to open, or null. */
  href: string | null;
  /* The API's message, unchanged. */
  message: string;
  /* The original text, for anything this does not recognise. */
  raw: string;
}

/* Snapshot content keys → the admin page that edits them. */
const CONTENT: Record<string, { label: string; href: string; detail?: (segment: string) => string | null }> = {
  news: { label: "Posts (news)", href: "/posts" },
  blogs: { label: "Posts (blogs)", href: "/posts" },
  events: { label: "Events", href: "/events" },
  appeals: { label: "Appeals", href: "/appeals" },
  generalDonation: { label: "Donation page", href: "/donation-page" },
  homepage: { label: "Homepage", href: "/homepage" },
  about: { label: "About page", href: "/about" },
  team: { label: "Team", href: "/team" },
  programs: { label: "Programs", href: "/programs" },
  metrics: { label: "Impact figures", href: "/impact/figures" },
  impact: { label: "Impact page", href: "/impact" },
  transparency: { label: "Transparency", href: "/transparency" },
  reports: { label: "Transparency documents", href: "/transparency/documents" },
  stories: { label: "Stories", href: "/stories" },
  projects: { label: "Projects", href: "/projects" },
  careers: { label: "Careers page", href: "/careers" },
  howWeWork: { label: "How We Work page", href: "/how-we-work" },
  policies: { label: "Policies", href: "/policies", detail: (s) => (Object.hasOwn(POLICY_PAGES, s) ? `/policies/${s}` : null) },
  getInvolved: { label: "Get Involved", href: "/get-involved", detail: (s) => (Object.hasOwn(GET_INVOLVED_PAGES, s) ? `/get-involved/${s}` : null) },
  announcementBar: { label: "Announcements", href: "/announcements" },
  popup: { label: "Popups", href: "/popups" },
  storyStrip: { label: "Highlights", href: "/highlights" },
};
const POLICY_PAGES: Record<string, string> = { privacy: "Privacy Policy", terms: "Terms of Use", donation: "Donation Policy" };
const GET_INVOLVED_PAGES: Record<string, string> = { hub: "Get Involved page", volunteer: "Volunteer page", fellowship: "Fellowship page", partner: "Partner With Us page", fundraise: "Fundraise With Us page", travel: "Travel With Us page" };

/* The publish's own section names (apps/api publishing/service.ts
   #sections / #pages), as a scheduled item is reported: "schedule.<name>.<id>". */
const SCHEDULED: Record<string, { href: string; record?: true }> = {
  "News and blogs": { href: "/posts", record: true },
  Events: { href: "/events", record: true },
  Appeals: { href: "/appeals", record: true },
  Team: { href: "/team", record: true },
  Programs: { href: "/programs", record: true },
  "Impact figures": { href: "/impact/figures", record: true },
  "Transparency documents": { href: "/transparency/documents", record: true },
  Stories: { href: "/stories", record: true },
  Projects: { href: "/projects", record: true },
  "Donation page": { href: "/donation-page" },
  Homepage: { href: "/homepage" },
  "About page": { href: "/about" },
  "Impact page": { href: "/impact" },
  Transparency: { href: "/transparency" },
  "Careers page": { href: "/careers" },
  "How We Work page": { href: "/how-we-work" },
  "Privacy Policy": { href: "/policies/privacy" },
  "Terms of Use": { href: "/policies/terms" },
  "Donation Policy": { href: "/policies/donation" },
  "Get Involved page": { href: "/get-involved/hub" },
  "Volunteer page": { href: "/get-involved/volunteer" },
  "Fellowship page": { href: "/get-involved/fellowship" },
  "Partner With Us page": { href: "/get-involved/partner" },
  "Fundraise With Us page": { href: "/get-involved/fundraise" },
  "Travel With Us page": { href: "/get-involved/travel" },
  "Announcement bar": { href: "/announcements" },
  Popup: { href: "/popups" },
  Highlights: { href: "/highlights" },
};

/* The How We Work page (#7): a problem inside it names the part of the
   editor — "card 2", "passage 3", "page header". */
const howWeWorkPart = (rest: string[]): string | null => {
  const [part, a, b] = rest;
  if (part === "rows") return /^\d+$/.test(a ?? "") ? `passage ${Number(a) + 1}` : "passages";
  if (part === "practices") return a === "items" && /^\d+$/.test(b ?? "") ? `card ${Number(b) + 1}` : "In practice";
  if (part === "kicker" || part === "heading" || part === "body") return "page header";
  return null;
};

/* Pages built from blocks: a problem inside one names its block. */
const BLOCK_PAGES = new Set(["homepage", "about", "impact", "generalDonation"]);

/* The same, as one line of text ("Impact page · block 6 — refers to …"),
   for messages that cannot hold a link. */
export const publishProblemLine = (raw: string): string => {
  const p = describePublishProblem(raw);
  return p.where ? `${p.where} — ${p.message}` : p.message;
};

export function describePublishProblem(raw: string): PublishProblem {
  const split = raw.indexOf(": ");
  const path = (split === -1 ? raw : raw.slice(0, split)).replace(/^(snapshot\.)+/, "");
  const message = split === -1 ? raw : raw.slice(split + 2);
  const unknown: PublishProblem = { where: null, href: null, message: raw.replace(/^(snapshot\.|settings\.)+/, ""), raw };
  const [head, key, ...rest] = path.split(".");

  if (head === "settings") return { where: "Settings", href: "/settings", message, raw };
  if (head === "media") return { where: "Media library", href: "/media", message, raw };

  if (head === "schedule" && key) {
    /* "schedule.<section name>.<id>": the publish's own section labels (no dots). */
    const target = Object.hasOwn(SCHEDULED, key) ? SCHEDULED[key] : undefined;
    if (!target) return unknown;
    const id = rest.join(".");
    return { where: `${key} · scheduled publication`, href: target.record && id ? `${target.href}/${encodeURIComponent(id)}` : target.href, message, raw };
  }

  if (head === "content" && key && Object.hasOwn(CONTENT, key)) {
    const page = CONTENT[key]!;
    const first = rest[0];
    let where = page.label;
    let href = page.href;
    const detail = first !== undefined && page.detail?.(first);
    if (detail) {
      href = detail;
      where = `${page.label} · ${key === "policies" ? POLICY_PAGES[first!] : GET_INVOLVED_PAGES[first!]}`;
    } else if (key === "howWeWork" && howWeWorkPart(rest)) {
      where = `${page.label} · ${howWeWorkPart(rest)}`;
    } else if (BLOCK_PAGES.has(key) && first === "sections" && /^\d+$/.test(rest[1] ?? "")) {
      where = `${page.label} · block ${Number(rest[1]) + 1}`;
    } else if (first !== undefined && /^\d+$/.test(first)) {
      where = `${page.label} · item ${Number(first) + 1}`;
    } else if (first !== undefined && !["sections", "status", "orgId", "releaseMarker", "seo"].includes(first)) {
      /* A record named by its address ("content.team.aquib-yazdani"). */
      where = `${page.label} · ${first}`;
    }
    return { where, href, message, raw };
  }
  return unknown;
}
