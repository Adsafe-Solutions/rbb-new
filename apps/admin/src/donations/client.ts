import type { DonationCheckout, GeneralDonationPage } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The general donation page and the donation provider's campaigns. Every
   provider call goes through the API — the admin never talks to Givebutter
   and never sees its key. */

export type { DonationCheckout, GeneralDonationPage };

export interface DonationPageView {
  record: GeneralDonationPage | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of it is on the website. */
  live: boolean;
  /* M15: when the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

export type DonationPageChanges = Partial<Pick<GeneralDonationPage, "hero" | "sections" | "donation" | "status">> & { seo?: GeneralDonationPage["seo"] | null };

export const donationPageApi = {
  get: () => api<DonationPageView>("/api/v1/donation-page"),
  update: (revision: number, changes: DonationPageChanges) => api<DonationPageView>("/api/v1/donation-page", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  act: pageAct<DonationPageView>("donation-page"),
  schedule: pageSchedule<DonationPageView>("donation-page"),
  unschedule: pageUnschedule<DonationPageView>("donation-page"),
};

/* What the provider reports about a campaign — shown to the editor while
   configuring a checkout; never stored by the CMS. */
export interface ProviderCampaign {
  campaignId: string;
  campaignCode: string;
  title: string;
  status: string;
  currency: string;
  checkout: { frequencies: string[]; defaultFrequency: string | null; amounts: Record<string, number[]>; minimumAmount: number | null };
}

export const campaignsApi = {
  get: (campaignId: string) => api<ProviderCampaign>(`/api/v1/integrations/donations/campaigns/${encodeURIComponent(campaignId)}`),
};

export const FREQUENCY_LABELS: Record<string, string> = { once: "One-time", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
