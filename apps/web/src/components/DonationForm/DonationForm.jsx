import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../Button/Button.jsx";
import FormField from "../FormField/FormField.jsx";
import FormSummary from "../FormSummary/FormSummary.jsx";
import SubmitButton from "../SubmitButton/SubmitButton.jsx";
import FieldError from "../FieldError/FieldError.jsx";
import { CONTROL } from "../TextInput/TextInput.jsx";
import { FORM_COPY } from "../../content/index.js";
import { policyLink } from "../../content/policies.js";
import { cx } from "../../lib/cx.js";
import { EMAIL_PATTERN, HONEYPOT_FIELD } from "../../lib/formSchema.js";
import { toDecimalString, toMinorUnits } from "../../lib/money.js";
import { PAYMENT_CONNECTED, startPayment } from "../../lib/payment.js";

/* THE donation form — the only one on the site. Every donation page
   (components/DonationExperience), the header's Donate popup
   (components/DonateDialog) and any future page draw this component;
   only the page around it changes. Never a second, page-specific form.

     config    what may be given (content/donation.js DONATION.form.config):
               { frequencyOptions: { oneTime, monthly }, currency,
                 presetAmounts, allowCustomAmount, minimumAmount,
                 maximumAmount } — amounts in MAJOR units
     copy      its words (DONATION.form.copy)
     donation  where the gift is made from — { type, appeal?, campaign?,
               project?, designation? } — handed to the payment boundary
               with the gift, never shown or asked of the donor
     formId    prefix for every element id: the popup can draw this form
               over a page that already shows it

   The flow: fill in → submit → checks (errors beside each field and in
   the summary at the top, focused) → "Preparing your payment…" while
   lib/payment.js `startPayment` answers → its outcome. With no provider
   connected that outcome is "unavailable": the provider-error panel, a
   way back to the details, nothing taken, nothing sent. NEVER a
   success, a payment id or a receipt that did not happen.

   Amounts live as integers in minor units (lib/money.js — no floating
   point). With no approved currency (`currency: null`) amounts are whole
   numbers with no symbol; with one, Intl formats them in it.

   Frequency: only the options `frequencyOptions` enables are drawn. With
   monthly off there is no monthly control at all — not a disabled one —
   so nothing pretends recurring giving works. Turning it on is that one
   flag, once the payment provider supports it.

   While no provider is connected the card carries `data-donation-preview`,
   which the release check reads to keep a production release blocked
   (scripts/lib/release-checks.mjs). Nothing about it is shown. */
const PHONE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

/* Decimal places for a currency, or 0 with none (whole amounts). */
function exponentFor(currency) {
  if (!currency) return 0;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

/* Minor units → display text. Without a currency, digits grouped by hand
   (no Intl): the pre-rendered text must match the hydrated text. */
function formatAmount(minor, currency, exponent) {
  if (currency) {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: exponent }).format(
        toDecimalString(minor, exponent)
      );
    } catch {
      /* fall through to the plain form */
    }
  }
  const [whole, fraction] = (toDecimalString(minor, exponent) ?? "0").split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

export default function DonationForm({ config, copy, donation = { type: "general" }, formId: FORM_ID = "donation", className = "" }) {
  const privacy = policyLink("privacy");
  const { currency = null, frequencyOptions = { oneTime: true, monthly: false } } = config;
  const exponent = exponentFor(currency);
  const toMinor = (major) => toMinorUnits(String(major), exponent);
  const presets = (config.presetAmounts ?? []).map(toMinor).filter((m) => m !== null);
  const min = config.minimumAmount != null ? toMinor(config.minimumAmount) : null;
  const max = config.maximumAmount != null ? toMinor(config.maximumAmount) : null;
  const custom = config.allowCustomAmount !== false;
  const money = (minor) => formatAmount(minor, currency, exponent);

  const frequencies = [
    frequencyOptions.oneTime !== false && { value: "one-time", label: copy.frequency.oneTime },
    frequencyOptions.monthly && { value: "monthly", label: copy.frequency.monthly },
  ].filter(Boolean);

  /* form | submitting | unavailable | error */
  const [phase, setPhase] = useState("form");
  const [frequency, setFrequency] = useState(frequencies[0]?.value ?? "one-time");
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  /* False on the pre-rendered page and until React takes over. The form
     is in the HTML from the start, and without JavaScript a native submit
     would send the typed details to this page's URL — so its button stays
     disabled until the page is hydrated. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const busy = useRef(false);
  const summaryRef = useRef(null);
  const statusRef = useRef(null);

  /* An outcome replaces the form, so focus goes to it. */
  useEffect(() => {
    if (phase === "unavailable" || phase === "error") statusRef.current?.focus();
  }, [phase]);

  const f = copy.fields;
  const m = copy.messages;
  const fields = [
    { name: "name", type: "text", required: true, ...f.name },
    { name: "email", type: "email", required: true, ...f.email },
    { name: "phone", type: "text", required: false, ...f.phone },
  ];

  /* The amount the donor chose, in minor units, or an error message. */
  function amount() {
    if (!choice) return { error: m.chooseAmount };
    if (choice !== "other") return { minor: Number(choice) };
    const minor = toMinorUnits(other, exponent);
    if (minor === null || minor === 0) return { error: m.amountFormat(exponent) };
    if ((min != null && minor < min) || (max != null && minor > max))
      return { error: m.amountRange(money(min ?? 0), money(max ?? minor)) };
    return { minor };
  }

  function validate(v = values) {
    const found = {};
    const a = amount();
    if (a.error) found.amount = a.error;
    if (!(v.name ?? "").trim()) found.name = m.name;
    if (!EMAIL_PATTERN.test((v.email ?? "").trim())) found.email = m.email;
    const phone = (v.phone ?? "").trim();
    if (phone && !PHONE.test(phone)) found.phone = m.phone;
    return found;
  }

  const update = (name, value) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (attempted) setErrors(validate(next));
  };

  /* Re-check the amount as it is corrected, once it has shown an error. */
  useEffect(() => {
    if (attempted) setErrors((e) => ({ ...e, amount: amount().error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, other]);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy.current) return;
    const found = validate();
    setErrors(found);
    setAttempted(true);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    /* The bot trap: a filled honeypot is dropped without telling anyone. */
    if (event.currentTarget.elements.namedItem(HONEYPOT_FIELD)?.value) return;

    busy.current = true;
    setPhase("submitting");
    const result = await startPayment({
      amount: { minor: amount().minor, currency },
      frequency,
      donor: {
        name: values.name.trim(),
        email: values.email.trim(),
        ...(values.phone?.trim() && { phone: values.phone.trim() }),
      },
      context: donation,
    }).catch(() => ({ outcome: "error" }));
    busy.current = false;
    /* A connected provider takes over from here (its own window or page);
       anything else is said plainly. */
    setPhase(result.outcome === "unavailable" ? "unavailable" : result.outcome === "error" ? "error" : "form");
  }

  const card = "rounded-2xl border-rim bg-paper-white p-5 text-bumble-ink cast-lg sm:p-8";
  const previewMark = PAYMENT_CONNECTED ? {} : { "data-donation-preview": "" };

  /* After a submit that could not go ahead: one panel, focused, with a
     way back to the details (kept as they were). */
  if (phase === "unavailable" || phase === "error") {
    return (
      <div data-tone="card" className={cx(card, className)} {...previewMark}>
        <div ref={statusRef} tabIndex={-1} role="alert" className="rounded-2xl border-2 border-bumble-honey p-5 outline-none sm:p-6">
          <h3 className="type-card text-trust-blue">{copy.unavailable.heading}</h3>
          <p className="mt-2">{copy.unavailable.body}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <Button onClick={() => setPhase("form")} variant="outline" className="whitespace-normal!">
            {copy.change}
          </Button>
        </div>
      </div>
    );
  }

  const submitting = phase === "submitting";
  const amountError = errors.amount;
  const summaryFields = [{ name: "amount" }, ...fields];

  /* An amount tile: a real radio, visually hidden, with the tile as its
     label. Selected = Deep Trust Blue border, a Sky Blue wash and a tick —
     never colour alone. The keyboard ring (Night, outside the tile) is a
     different shape from the selected border, so "focused" and "chosen"
     can never be confused. */
  const radio = (value, label, first) => (
    <label key={value} className="relative block cursor-pointer">
      <input
        id={first ? `${FORM_ID}-amount` : undefined}
        type="radio"
        name="amount"
        value={value}
        checked={choice === value}
        onChange={() => {
          setChoice(value);
          /* One amount at a time: picking a preset empties the typed one,
             so the field never shows a number that will not be sent. */
          setOther("");
        }}
        disabled={submitting}
        aria-describedby={amountError ? `${FORM_ID}-amount-error` : undefined}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border-2 border-trust-blue/60 bg-paper-white px-2 py-3 text-center text-[18px] font-extrabold text-trust-blue sm:text-[19px]",
          "transition duration-150 hover:border-trust-blue hover:bg-mist",
          "peer-checked:border-trust-blue peer-checked:bg-bumble-honey/15 peer-checked:shadow-[inset_0_0_0_1px_var(--color-trust-blue)]",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-night",
          "[&>svg]:hidden peer-checked:[&>svg]:block"
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
          <path d="m5 12 5 5 9-10" />
        </svg>
        {label}
      </span>
    </label>
  );

  /* What the donor has chosen so far, for the button — the same value a
     submit would send, or nothing. */
  const chosen = choice ? amount() : null;
  const summary = chosen && !chosen.error ? money(chosen.minor) : null;
  /* With no presets the typed amount IS the amount control, so it takes
     the id the error summary links to. */
  const otherId = presets.length ? `${FORM_ID}-other` : `${FORM_ID}-amount`;

  /* A section label inside the card: small capitals, never a numbered
     step — the card reads as one short form, not a long procedure. */
  const LABEL = "type-meta block text-trust-blue";

  return (
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={`${FORM_ID}-heading`}
      aria-busy={submitting || undefined}
      data-tone="card"
      {...previewMark}
      className={cx("relative", card, className)}
    >
      <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={`${FORM_ID}-${HONEYPOT_FIELD}`}>{FORM_COPY.honeypotLabel}</label>
        <input id={`${FORM_ID}-${HONEYPOT_FIELD}`} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* The card's head. Focusable (-1) so "Donate" elsewhere on the page
          can bring the reader here and say where they are. */}
      <div className="border-b-2 border-dashed border-hair pb-5">
        <h2 id={`${FORM_ID}-heading`} tabIndex={-1} className="text-[24px] font-black leading-tight tracking-tight text-trust-blue outline-none">
          {copy.heading}
        </h2>
        {copy.intro && <p className="mt-1.5 text-[15px] leading-snug text-graphite">{copy.intro}</p>}
      </div>

      <div className="mt-6 grid gap-7">
        <FormSummary ref={summaryRef} heading={FORM_COPY.summaryHeading} errors={errors} fields={summaryFields} formId={FORM_ID} />

        {/* Frequency. Real radios in a fieldset: arrow keys move between
            them and a screen reader hears the group's name. Only the
            options the config enables exist. */}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={LABEL}>{copy.frequency.legend}</legend>
          <div className={cx("mt-3 grid gap-1 rounded-xl border-2 border-trust-blue bg-mist p-1", frequencies.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {frequencies.map((option) => (
              <label key={option.value} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name={`${FORM_ID}-frequency`}
                  value={option.value}
                  checked={frequency === option.value}
                  onChange={() => setFrequency(option.value)}
                  disabled={submitting}
                  className="peer sr-only"
                />
                <span className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-center font-extrabold text-trust-blue peer-checked:bg-trust-blue peer-checked:text-paper-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-night">
                  {frequency === option.value && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Amount: the presets, then the typed amount. ONE amount is ever
            chosen — `choice` is a preset or "other", and "other" means the
            field below. */}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={LABEL}>
            {copy.amountLegend} <span className="font-medium normal-case tracking-normal text-graphite">({FORM_COPY.required})</span>
          </legend>
          <FieldError id={amountError ? `${FORM_ID}-amount-error` : null} prefix={FORM_COPY.errorPrefix}>
            {amountError}
          </FieldError>
          {presets.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 min-[400px]:grid-cols-3">
              {presets.map((minor, i) => radio(String(minor), money(minor), i === 0))}
            </div>
          )}

          {custom && (
            <div className={presets.length ? "mt-4" : "mt-3"}>
              <label htmlFor={otherId} className="block font-bold text-trust-blue">
                {copy.otherAmount}
              </label>
              {min != null && max != null && (
                <p id={`${FORM_ID}-other-hint`} className="mt-0.5 text-[15px] text-graphite">
                  {copy.otherHint(money(min), money(max))}
                </p>
              )}
              <div className="relative mt-2">
                <input
                  id={otherId}
                  type="text"
                  inputMode={exponent ? "decimal" : "numeric"}
                  autoComplete="off"
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    /* Typing replaces the chosen preset; clearing the field
                       leaves nothing chosen. */
                    setChoice(e.target.value ? "other" : "");
                  }}
                  onFocus={() => other && setChoice("other")}
                  disabled={submitting}
                  aria-invalid={amountError && choice === "other" ? true : undefined}
                  aria-describedby={cx(min != null && max != null && `${FORM_ID}-other-hint`, amountError && `${FORM_ID}-amount-error`) || undefined}
                  className={cx(CONTROL, "text-[20px] font-bold", currency && "pr-16", choice === "other" && "border-trust-blue bg-bumble-honey/10")}
                />
                {currency && (
                  <span aria-hidden="true" className="type-meta pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-graphite">
                    {currency}
                  </span>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {/* The donor: three fields, nothing more. */}
        <fieldset className="m-0 grid min-w-0 gap-5 border-0 p-0">
          <legend className={cx(LABEL, "mb-1")}>{copy.detailsLegend}</legend>
          {fields.map((field) => (
            <FormField
              key={field.name}
              formId={FORM_ID}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={update}
              onBlur={() => {}}
              disabled={submitting}
              copy={FORM_COPY}
            />
          ))}
        </fieldset>

        {/* The action. It repeats the amount, so the donor sees what they
            are about to give on the control that gives it. Guarded against
            a second press (SubmitButton, and `busy` in onSubmit). */}
        <div className="grid gap-3 border-t-2 border-dashed border-hair pt-6">
          <SubmitButton busy={submitting} busyLabel={copy.submitting} disabled={!hydrated} block>
            <span>{copy.submit}</span>
            {summary && (
              <>
                {" "}
                <span className="font-black">· {summary}</span>
              </>
            )}
          </SubmitButton>
          {submitting ? (
            <p role="status" className="text-center text-[15px] font-medium text-graphite">
              {copy.submitting}
            </p>
          ) : (
            !summary && <p className="text-center text-[15px] text-graphite">{copy.summaryEmpty}</p>
          )}
          {privacy && (
            <p className="text-center text-[15px] text-graphite">
              <Link to={privacy.to} className="font-semibold text-trust-blue underline underline-offset-4">
                {privacy.label}
              </Link>
            </p>
          )}
        </div>

        {/* Help: only routes that exist and are true (content/donation.js). */}
        {copy.help?.links?.length > 0 && (
          <nav aria-label={copy.help.heading} className="rounded-xl bg-mist p-4">
            <p className="type-meta text-trust-blue">{copy.help.heading}</p>
            <ul className="mt-2 grid gap-1">
              {copy.help.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="group inline-flex min-h-8 items-center gap-2 font-semibold text-trust-blue underline-offset-4 hover:underline">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </form>
  );
}
