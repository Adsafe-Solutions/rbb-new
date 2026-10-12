import type { TeamMember } from "../../content/client";

/* The team's groups, as the website names them (its TEAM_GROUPS
   headings), in page order. The groups themselves are the contract's. */
export const TEAM_GROUPS: { id: TeamMember["group"]; label: string }[] = [
  { id: "leadership", label: "Leadership" },
  { id: "team", label: "Team members" },
];
