import { api, apiDownload } from "../api";

/* Admin → Audience (owners only): every person across the website forms. */

export interface AudienceMember {
  email: string;
  name: string;
  forms: string[];
  submissions: number;
  firstAt: string;
  lastAt: string;
  marketing: "Yes" | "No" | null;
  marketingAt: string | null;
}

export interface AudiencePage {
  items: AudienceMember[];
  total: number;
  matching: number;
  optedIn: number;
  page: number;
  pages: number;
}

export interface AudienceFilters {
  q: string;
  marketing: "" | "yes" | "no" | "unknown";
  form: string;
}
export const NO_AUDIENCE_FILTERS: AudienceFilters = { q: "", marketing: "", form: "" };

export const audienceQuery = (f: AudienceFilters, page = 1): string => {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.marketing) p.set("marketing", f.marketing);
  if (f.form) p.set("form", f.form);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const audienceApi = {
  list: (f: AudienceFilters, page = 1) => api<AudiencePage>(`/api/v1/audience${audienceQuery(f, page)}`),
  exportCsv: (f: AudienceFilters) => apiDownload(`/api/v1/audience/export${audienceQuery(f)}`),
};
