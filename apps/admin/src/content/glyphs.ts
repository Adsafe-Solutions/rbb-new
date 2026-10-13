import type { Program } from "@rbb/content-schema";

/* The site's line glyphs (the contract's PROGRAM_ICONS; apps/web
   components/LineIcon) — a program's icon, and a How We Work practice's. */
export const LINE_GLYPHS: { value: Program["icon"]; label: string }[] = [
  { value: "education", label: "Education (book)" },
  { value: "health", label: "Health (heart)" },
  { value: "livelihoods", label: "Livelihoods (growth)" },
  { value: "community", label: "Community (people)" },
  { value: "donate", label: "Donate" },
  { value: "volunteer", label: "Volunteer" },
  { value: "partner", label: "Partner" },
  { value: "fellowship", label: "Fellowship" },
  { value: "travel", label: "Travel" },
  { value: "fundraise", label: "Fundraise" },
  { value: "document", label: "Document" },
  { value: "shield", label: "Shield" },
  { value: "chart", label: "Chart" },
];
