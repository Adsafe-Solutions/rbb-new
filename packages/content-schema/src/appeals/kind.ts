import { z } from "zod";

/* The two kinds of appeal the site lists (/appeals/emergency,
   /appeals/campaigns). The general donation page is not an appeal kind:
   it is a singleton (GeneralDonationPage). */
export const AppealKind = z.enum(["emergency", "campaign"]);
export type AppealKind = z.infer<typeof AppealKind>;
