import type { Report } from "@rbb/content-schema";

/* The three document lists of the Transparency chapter, by the headings
   the website gives them (apps/web content/transparency.js). */
export const REPORT_CATEGORIES: { id: Report["category"]; label: string; noun: string }[] = [
  { id: "annualReport", label: "Annual reports", noun: "annual report" },
  { id: "financial", label: "Financial information", noun: "financial document" },
  { id: "governance", label: "Governance", noun: "governance document" },
];
