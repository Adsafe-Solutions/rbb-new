import { z } from "zod";

/* The kinds of appeal the site lists, each its own subsection of
   Appeals: /appeals/emergency, /appeals/campaigns and (2026-10-17, RBB's
   request) /appeals/special. The general donation page is not an appeal
   kind: it is a singleton (GeneralDonationPage). */
export const AppealKind = z.enum(["emergency", "campaign", "special"]);
export type AppealKind = z.infer<typeof AppealKind>;
