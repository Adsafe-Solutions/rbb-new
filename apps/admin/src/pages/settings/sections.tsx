import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, FormField, Input, Plus, Select, Switch, Textarea, Trash2 } from "../../design-system";
import { MediaPicker } from "../../media/MediaPicker";
import type { SiteSettings } from "../../settings/client";
import styles from "./SettingsPage.module.css";

/* One editor per settings section. Typed fields only — no free-form JSON —
   with the contract's limits as maxLength, so most mistakes cannot be
   typed at all; the API validates everything again on save. */

export interface SectionProps<K extends keyof SiteSettings> {
  value: SiteSettings[K];
  onChange: (value: SiteSettings[K]) => void;
  readOnly: boolean;
  /* The API's message for a field path inside this section, if any. */
  errorFor: (path: string) => string | undefined;
}

const orUndefined = (value: string) => (value.trim() === "" ? undefined : value);

export function GeneralSection({ value, onChange, readOnly, errorFor }: SectionProps<"general">) {
  return (
    <div className={styles.fields}>
      <FormField label="Short name" required helper="The everyday name — in the header, the footer and the copyright line." error={errorFor("shortName")} disabled={readOnly}>
        <Input maxLength={40} value={value.shortName} onChange={(e) => onChange({ ...value, shortName: e.target.value })} />
      </FormField>
      <FormField label="Full name" required helper="The organization's full name — in page titles and links home." error={errorFor("name")} disabled={readOnly}>
        <Input maxLength={120} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </FormField>
      <FormField label="Summary" required helper="One sentence about the organization. Up to 300 characters." error={errorFor("summary")} disabled={readOnly}>
        <Textarea rows={3} maxLength={300} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} />
      </FormField>
    </div>
  );
}

export function BrandingSection({ value, onChange, readOnly, errorFor }: SectionProps<"branding">) {
  return (
    <div className={styles.fields}>
      <Alert tone="info">Branding images are published with the settings. The public website uses its built-in logo files until it reads branding from settings.</Alert>
      <MediaPicker label="Logo" helper="A ready image from the media library." value={value.logoId} onChange={(logoId) => onChange({ ...value, logoId })} disabled={readOnly} error={errorFor("logoId")} />
      <MediaPicker label="Favicon" helper="A small, square image from the media library." value={value.faviconId} onChange={(faviconId) => onChange({ ...value, faviconId })} disabled={readOnly} error={errorFor("faviconId")} />
    </div>
  );
}

type Method = SiteSettings["contact"]["methods"][number];
const METHOD_TYPES = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other (with a link)" },
];

export function ContactSection({ value, onChange, readOnly, errorFor }: SectionProps<"contact">) {
  const office = value.office ?? { address: "" };
  const setMethod = (index: number, method: Method) => onChange({ ...value, methods: value.methods.map((m, i) => (i === index ? method : m)) });
  const setOffice = (field: keyof NonNullable<SiteSettings["contact"]["office"]>, text: string) => onChange({ ...value, office: { ...office, [field]: field === "address" ? text : orUndefined(text) } });
  return (
    <div className={styles.fields}>
      <Alert tone="info">Only add details you have confirmed. Each one appears on the website once the settings are published.</Alert>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Contact methods</legend>
        {value.methods.length === 0 && <p className={styles.muted}>No contact methods yet.</p>}
        {value.methods.map((method, i) => (
          <div key={method.id} className={styles.method} data-testid="contact-method">
            <div className={styles.methodRow}>
              <FormField label="Type" disabled={readOnly}>
                <Select options={METHOD_TYPES} value={method.type} onChange={(e) => setMethod(i, { ...method, type: e.target.value as Method["type"] })} />
              </FormField>
              <FormField label="Label" required disabled={readOnly} error={errorFor(`methods.${i}.label`)}>
                <Input maxLength={80} value={method.label} onChange={(e) => setMethod(i, { ...method, label: e.target.value })} placeholder="General inquiries" />
              </FormField>
            </div>
            <FormField label={method.type === "email" ? "Email address" : method.type === "phone" ? "Phone number" : "Text shown"} required disabled={readOnly} error={errorFor(`methods.${i}.value`)}>
              <Input maxLength={200} value={method.value} onChange={(e) => setMethod(i, { ...method, value: e.target.value })} type={method.type === "email" ? "email" : method.type === "phone" ? "tel" : "text"} />
            </FormField>
            {method.type === "other" && (
              <FormField label="Link" helper="An https:// address." disabled={readOnly} error={errorFor(`methods.${i}.href`)}>
                <Input maxLength={2048} value={method.href ?? ""} onChange={(e) => setMethod(i, { ...method, href: orUndefined(e.target.value) })} />
              </FormField>
            )}
            <FormField label="Description" helper="Optional. A short note shown with this method on the Contact page, e.g. “For questions about volunteering.” Up to 300 characters." disabled={readOnly} error={errorFor(`methods.${i}.description`)}>
              <Textarea rows={2} maxLength={300} value={method.description ?? ""} onChange={(e) => setMethod(i, { ...method, description: orUndefined(e.target.value) })} />
            </FormField>
            {!readOnly && (
              <Button size="sm" variant="ghost" leadingIcon={<Trash2 />} className={styles.remove} onClick={() => onChange({ ...value, methods: value.methods.filter((_, j) => j !== i) })}>
                Remove {method.label || "method"}
              </Button>
            )}
          </div>
        ))}
        {!readOnly && value.methods.length < 10 && (
          <Button size="sm" leadingIcon={<Plus />} onClick={() => onChange({ ...value, methods: [...value.methods, { id: `method-${Date.now().toString(36)}`, type: "email", label: "", value: "" }] })}>
            Add contact method
          </Button>
        )}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Office</legend>
        <FormField label="Address" helper="Leave empty if there is no public address." disabled={readOnly} error={errorFor("office.address")}>
          <Input maxLength={300} value={office.address} onChange={(e) => setOffice("address", e.target.value)} />
        </FormField>
        <div className={styles.methodRow}>
          <FormField label="City" disabled={readOnly}>
            <Input maxLength={120} value={office.city ?? ""} onChange={(e) => setOffice("city", e.target.value)} />
          </FormField>
          <FormField label="Region" disabled={readOnly}>
            <Input maxLength={120} value={office.region ?? ""} onChange={(e) => setOffice("region", e.target.value)} />
          </FormField>
          <FormField label="Country" disabled={readOnly}>
            <Input maxLength={120} value={office.country ?? ""} onChange={(e) => setOffice("country", e.target.value)} />
          </FormField>
        </div>
        <FormField label="Map link" helper="An https:// link to a map, if you want one shown." disabled={readOnly} error={errorFor("office.mapUrl")}>
          <Input maxLength={2048} value={office.mapUrl ?? ""} onChange={(e) => setOffice("mapUrl", e.target.value)} />
        </FormField>
      </fieldset>
      <FormField label="Office hours" disabled={readOnly} error={errorFor("hours")}>
        <Input maxLength={200} value={value.hours ?? ""} onChange={(e) => onChange({ ...value, hours: orUndefined(e.target.value) })} />
      </FormField>
      <FormField label="Response time" helper="For example: “We reply within two working days.”" disabled={readOnly} error={errorFor("responseTime")}>
        <Input maxLength={200} value={value.responseTime ?? ""} onChange={(e) => onChange({ ...value, responseTime: orUndefined(e.target.value) })} />
      </FormField>
    </div>
  );
}

const PLATFORMS = [
  { platform: "instagram", label: "Instagram" },
  { platform: "facebook", label: "Facebook" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "linkedin", label: "LinkedIn" },
  { platform: "youtube", label: "YouTube" },
] as const;

export function SocialSection({ value, onChange, readOnly, errorFor }: SectionProps<"social">) {
  const urlOf = (platform: string) => value.find((s) => s.platform === platform)?.url ?? "";
  const set = (platform: (typeof PLATFORMS)[number]["platform"], url: string) => {
    const next = PLATFORMS.map((p) => (p.platform === platform ? { platform, url } : { platform: p.platform, url: urlOf(p.platform) })).filter((s) => s.url.trim() !== "");
    onChange(next);
  };
  return (
    <div className={styles.fields}>
      <p className={styles.muted}>The organization's own account addresses. Only filled-in accounts appear on the website.</p>
      {PLATFORMS.map(({ platform, label }) => {
        const index = value.findIndex((s) => s.platform === platform);
        return (
          <FormField key={platform} label={label} helper={`https://www.${platform}.com/… — the account page, not the platform's home page.`} disabled={readOnly} error={index >= 0 ? errorFor(`${index}.url`) : undefined}>
            <Input type="url" maxLength={2048} value={urlOf(platform)} onChange={(e) => set(platform, e.target.value)} placeholder="https://" />
          </FormField>
        );
      })}
    </div>
  );
}

export function SeoSection({ value, onChange, readOnly, errorFor }: SectionProps<"seo">) {
  return (
    <div className={styles.fields}>
      <FormField label="Default description" required helper="What search results and link previews show for a page without its own description. Up to 200 characters." error={errorFor("description")} disabled={readOnly}>
        <Textarea rows={3} maxLength={200} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </FormField>
      <MediaPicker label="Default share image" helper="Shown when a page is shared and has no image of its own." value={value.ogImageId} onChange={(ogImageId) => onChange({ ...value, ogImageId })} disabled={readOnly} error={errorFor("ogImageId")} />
      <p className={styles.muted}>Whether a page can be indexed by search engines is decided by the website's release rules, not here.</p>
    </div>
  );
}

export function AnalyticsSection({ value, onChange, readOnly, errorFor }: SectionProps<"analytics">) {
  return (
    <div className={styles.fields}>
      <Alert tone="info">Public measurement IDs only — never keys or passwords. The website measures nothing until the organization approves measurement and a production build switches it on.</Alert>
      <FormField label="Google Analytics measurement ID" helper="Starts with G-, for example G-XXXXXXX." error={errorFor("googleAnalyticsId")} disabled={readOnly}>
        <Input maxLength={23} value={value.googleAnalyticsId ?? ""} onChange={(e) => onChange({ ...value, googleAnalyticsId: orUndefined(e.target.value.toUpperCase()) })} />
      </FormField>
      <FormField label="Microsoft Clarity project ID" helper="Lowercase letters and digits, from Clarity's settings." error={errorFor("clarityProjectId")} disabled={readOnly}>
        <Input maxLength={20} value={value.clarityProjectId ?? ""} onChange={(e) => onChange({ ...value, clarityProjectId: orUndefined(e.target.value.toLowerCase()) })} />
      </FormField>
    </div>
  );
}

export function DonationsSection({ value, onChange, readOnly, errorFor }: SectionProps<"donations">) {
  const form = value.form;
  const setForm = (changes: Partial<typeof form>) => onChange({ ...value, form: { ...form, ...changes } });
  const [presets, setPresets] = useState(form.presetAmounts.join(", "));
  useEffect(() => setPresets(form.presetAmounts.join(", ")), [form.presetAmounts]);
  return (
    <div className={styles.fields}>
      <Alert tone="info">The defaults for donation forms managed here. The donation pages and the Givebutter checkout are not changed by these settings.</Alert>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Frequencies offered</legend>
        <Checkbox label="One-time" checked={form.frequencyOptions.oneTime} disabled={readOnly} onChange={(e) => setForm({ frequencyOptions: { ...form.frequencyOptions, oneTime: e.target.checked } })} />
        <Checkbox label="Monthly" checked={form.frequencyOptions.monthly} disabled={readOnly} onChange={(e) => setForm({ frequencyOptions: { ...form.frequencyOptions, monthly: e.target.checked } })} />
        {errorFor("form.frequencyOptions") && <p className={styles.error}>{errorFor("form.frequencyOptions")}</p>}
      </fieldset>
      <div className={styles.methodRow}>
        <FormField label="Currency" helper="ISO code such as USD. Empty: amounts show as plain numbers." error={errorFor("form.currency")} disabled={readOnly}>
          <Input maxLength={3} value={form.currency ?? ""} onChange={(e) => setForm({ currency: e.target.value.trim() === "" ? null : e.target.value.toUpperCase() })} />
        </FormField>
        <FormField label="Minimum amount" error={errorFor("form.minimumAmount")} disabled={readOnly}>
          <Input type="number" min={0} step="any" value={String(form.minimumAmount)} onChange={(e) => setForm({ minimumAmount: Number(e.target.value) })} />
        </FormField>
        <FormField label="Maximum amount" error={errorFor("form.maximumAmount")} disabled={readOnly}>
          <Input type="number" min={0} step="any" value={String(form.maximumAmount)} onChange={(e) => setForm({ maximumAmount: Number(e.target.value) })} />
        </FormField>
      </div>
      <FormField label="Preset amounts" helper="Separated by commas, for example 25, 50, 100. Up to 8." error={errorFor("form.presetAmounts")} disabled={readOnly}>
        <Input
          value={presets}
          onChange={(e) => {
            setPresets(e.target.value);
            setForm({ presetAmounts: e.target.value.split(",").map((v) => v.trim()).filter(Boolean).map(Number) });
          }}
        />
      </FormField>
      <Switch label="Allow a custom amount" checked={form.allowCustomAmount} disabled={readOnly} onChange={(e) => setForm({ allowCustomAmount: e.target.checked })} />
      <FormField label="Closing heading" required helper="The heading of the band that closes every donation page." error={errorFor("closing.heading")} disabled={readOnly}>
        <Input maxLength={160} value={value.closing.heading} onChange={(e) => onChange({ ...value, closing: { ...value.closing, heading: e.target.value } })} />
      </FormField>
      <FormField label="Closing button label" required error={errorFor("closing.buttonLabel")} disabled={readOnly}>
        <Input maxLength={40} value={value.closing.buttonLabel} onChange={(e) => onChange({ ...value, closing: { ...value.closing, buttonLabel: e.target.value } })} />
      </FormField>
    </div>
  );
}

