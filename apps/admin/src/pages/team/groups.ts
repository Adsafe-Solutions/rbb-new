import type { TeamMember } from "../../content/client";

/* The team's groups, as the website names them (its TEAM_GROUPS
   headings), in page order. The groups themselves are the contract's. */
/* The note a team TEMPLATE carries as its release marker (the website's
   sample profiles carry the same words): a role, not a person. */
export const TEAM_TEMPLATE_NOTE = "Sample profile — this page shows how a team member's profile will appear. It describes a role, not a real person.";

export const TEAM_GROUPS: { id: TeamMember["group"]; label: string }[] = [
  { id: "leadership", label: "Leadership" },
  { id: "team", label: "Team members" },
];
