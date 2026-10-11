import { useState } from "react";
import { ApiRequestError } from "../api";
import { Alert, Button, Checkbox, FormField, Input, Select, ShieldCheck } from "../design-system";
import { FREQUENCY_LABELS, campaignsApi, type DonationCheckout, type ProviderCampaign } from "./client";
import styles from "../content/content.module.css";

/* A page's Givebutter checkout: which campaign and which Form widget take
   the gift, and an optional preselected frequency and amount. Public ids
   only — the API key never leaves the server, and the account id is the
   website's deployment setting.

   "Check with Givebutter" asks the API to read the campaign (the API asks
   Givebutter). It shows what the campaign offers so the defaults can be
   chosen from it; the API verifies the same thing again when the page is
   published. Givebutter cannot say which campaign a widget belongs to, so
   the widget id is the editor's to get right — the helper says so. */

interface Props {
  value: DonationCheckout | undefined;
  onChange: (value: DonationCheckout | undefined) => void;
  disabled: boolean;
  error: (path: string) => string | undefined;
  /* The error-path prefix of the checkout ("donation.checkout"). */
  path: string;
}

type Check = { state: "idle" } | { state: "checking" } | { state: "found"; campaign: ProviderCampaign } | { state: "failed"; message: string };

const EMPTY: DonationCheckout = { provider: "givebutter", campaignId: "", widgetId: "", widgetType: "form" };

export function CheckoutFields({ value, onChange, disabled, error, path }: Props) {
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const set = (changes: Partial<DonationCheckout>) => {
    const next = Object.fromEntries(Object.entries({ ...(value ?? EMPTY), ...changes }).filter(([, v]) => v !== undefined && v !== "")) as DonationCheckout;
    onChange({ ...next, provider: "givebutter", widgetType: "form", campaignId: next.campaignId ?? "", widgetId: next.widgetId ?? "" });
  };
  const err = (field: string) => error(`${path}.${field}`);
  const offered = check.state === "found" ? check.campaign.checkout.frequencies : Object.keys(FREQUENCY_LABELS);
  const amounts = check.state === "found" && value ? check.campaign.checkout.amounts[value.defaultFrequency ?? check.campaign.checkout.defaultFrequency ?? ""] : undefined;

  async function verify() {
    if (!value?.campaignId) return;
    setCheck({ state: "checking" });
    try {
      setCheck({ state: "found", campaign: await campaignsApi.get(value.campaignId) });
    } catch (caught) {
      const status = caught instanceof ApiRequestError ? caught.status : 0;
      setCheck({
        state: "failed",
        message:
          status === 404 ? "Givebutter has no campaign with this ID in the connected account." : status === 400 ? "A campaign ID is digits only." : status === 503 ? "Givebutter could not be reached, or the server's connection to it is not set up. Try again later." : "The campaign could not be checked. Try again.",
      });
    }
  }

  return (
    <div className={styles.fields}>
      <Checkbox
        label="Take donations with a Givebutter form on this page"
        description="Givebutter's own form handles the amount, payment and recurring gifts. Without it, the page shows the website's standard donation form."
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => {
          setCheck({ state: "idle" });
          onChange(e.target.checked ? { ...EMPTY } : undefined);
        }}
      />
      {value && (
        <>
          <div className={styles.row}>
            <FormField label="Campaign ID" required disabled={disabled} error={err("campaignId")} helper="The campaign's number in Givebutter (not its code).">
              <Input
                inputMode="numeric"
                maxLength={20}
                value={value.campaignId}
                onChange={(e) => {
                  setCheck({ state: "idle" });
                  set({ campaignId: e.target.value.trim() });
                }}
              />
            </FormField>
            <FormField label="Form widget ID" required disabled={disabled} error={err("widgetId")} helper="From the campaign's Form widget in Givebutter. Givebutter can't confirm which campaign a widget belongs to — use this campaign's widget.">
              <Input maxLength={16} value={value.widgetId} onChange={(e) => set({ widgetId: e.target.value.trim() })} />
            </FormField>
          </div>
          <div className={styles.inlineAction}>
            <Button size="sm" leadingIcon={<ShieldCheck />} loading={check.state === "checking"} disabled={disabled || !/^\d{1,20}$/.test(value.campaignId)} onClick={verify}>
              Check with Givebutter
            </Button>
          </div>
          {check.state === "found" && (
            <Alert tone={check.campaign.status === "active" ? "success" : "warning"} title={`“${check.campaign.title}” (${check.campaign.campaignCode})`} role="status">
              {check.campaign.status === "active" ? "Active in Givebutter." : `Givebutter reports this campaign as “${check.campaign.status}”: a page using it can't be published.`} Offers{" "}
              {check.campaign.checkout.frequencies.map((f) => FREQUENCY_LABELS[f] ?? f).join(", ") || "no listed frequencies"}
              {check.campaign.checkout.minimumAmount !== null && `, from ${check.campaign.checkout.minimumAmount} ${check.campaign.currency}`}.
            </Alert>
          )}
          {check.state === "failed" && (
            <Alert tone="danger" role="alert">
              {check.message}
            </Alert>
          )}
          <div className={styles.row}>
            <FormField label="Default frequency" disabled={disabled} error={err("defaultFrequency")} helper="Optional. Must be one the campaign offers.">
              <Select
                options={[{ value: "", label: "Campaign default" }, ...offered.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] ?? f }))]}
                value={value.defaultFrequency ?? ""}
                onChange={(e) => set({ defaultFrequency: (e.target.value || undefined) as DonationCheckout["defaultFrequency"] })}
              />
            </FormField>
            <FormField label="Default amount" disabled={disabled} error={err("defaultAmount")} helper={amounts?.length ? `Optional. This campaign offers ${amounts.join(", ")}.` : "Optional. Must be one of the campaign's own amounts."}>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={value.defaultAmount ?? ""}
                onChange={(e) => set({ defaultAmount: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </FormField>
          </div>
          <FormField label="Widget type" disabled helper="The website embeds Givebutter's Form widget.">
            <Select options={[{ value: "form", label: "Form" }]} value="form" onChange={() => {}} />
          </FormField>
        </>
      )}
    </div>
  );
}
