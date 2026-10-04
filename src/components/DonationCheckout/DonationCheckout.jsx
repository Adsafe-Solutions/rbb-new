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
import { DONATIONS_IN_BUILD, ENV } from "../../config/env.js";
import { cx } from "../../lib/cx.js";
import { EMAIL_PATTERN, HONEYPOT_FIELD } from "../../lib/formSchema.js";
import { currencyExponent, formatMoney, toDecimalString, toMinorUnits } from "../../lib/money.js";
import {
  createOrder,
  donationConfig,
  donationStatus,
  loadCheckout,
  newAttemptKey,
  verifyPayment,
} from "../../lib/donations.js";

/* Razorpay Checkout on the donation page — Document 22. Rendered by
   DonationAction only when `checkoutReady()` (content/donation.js) holds,
   and then only works once RBB's server answers with a configuration.

     loading          asking the server for the approved amount rules
     unavailable      the server has none (donations off, misconfigured,
                      unreachable) — says so; nothing to fill in
     form             approved amounts (+ a custom one if allowed), name,
                      email, optional phone
     creating         one order request in flight; repeats are ignored,
                      and a retry of the same attempt reuses its
                      idempotency key, so a double click cannot make two
     checkout_opened  Razorpay's window is open
     verifying        Checkout said "paid"; the SERVER is checking
     captured         the server verified it — the ONLY success shown
     authorized       received, not confirmed yet — polls the server
     cancelled        the window was closed first — retry, no blame
     failed           Razorpay reported the attempt failed — retry
     unknown          nothing can be said safely — never success; keeps
                      the reference, points to Contact, polls

   Nothing here trusts the browser: amounts are checked again by the
   server, which sets the currency and makes the order; the Checkout
   callback is only passed on for verification. Card, bank and UPI
   details are typed into Razorpay's own window, never into this page.

   Amounts and currency come from the server at run time and are never in
   this bundle. Copy: DONATION.donationAction.checkout (PROPOSED).

   PREVIEW (`preview`, content/donation.js `checkout.preview`) — the same
   card, drawn while donations are NOT open, so the form can be seen and
   tried. Its amounts and currency (¤, ISO "XXX": no currency) are
   placeholders from content, never the server's. It makes no request of
   any kind: no config call, no order, no Razorpay script. Submitting
   runs the same checks, then shows `preview.result` — never success,
   never a reference. The details typed in stay in React state and are
   gone when the page is left. Every network path below is also behind
   DONATIONS_IN_BUILD, so a build without a donations API carries none
   of it. The release gate blocks a production release while the preview
   is on the page (scripts/lib/release-checks.mjs). */
const FORM_ID = "donation";
const POLL_MS = 5000;
const POLL_TRIES = 12;
const PHONE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

/* Minor units → "¤1,500.00" without Intl — the preview's placeholder
   currency only (see `money` below). */
function previewMoney(minor, exponent, symbol) {
  const [whole, fraction] = (toDecimalString(minor, exponent) ?? "0").split(".");
  return `${symbol}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

export default function DonationCheckout({ copy, preview = null }) {
  const api = ENV.donationsApi;
  const privacy = policyLink("privacy");

  /* A preview has its placeholder configuration from the first render, so
     the prerendered page already shows the whole form. */
  const [phase, setPhase] = useState(preview ? "form" : "loading");
  const [config, setConfig] = useState(preview?.config ?? null);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState(null); // "error" | "rate-limited"
  const [order, setOrder] = useState(null);
  /* False on the prerendered page and until React takes over. The preview
     form is in the HTML from the start, and without JavaScript a native
     submit would send the typed details to this page's URL — so its
     button stays disabled until the page is hydrated. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const busy = useRef(false);
  const attemptKey = useRef(null);
  const shownAt = useRef(null);
  const summaryRef = useRef(null);
  const statusRef = useRef(null);

  /* Hydrated: ask the server what may be given. A preview never asks. */
  useEffect(() => {
    shownAt.current = Date.now();
    if (preview || !DONATIONS_IN_BUILD) return undefined;
    let live = true;
    donationConfig(api).then((c) => {
      if (!live) return;
      setConfig(c);
      setPhase(c ? "form" : "unavailable");
    });
    return () => {
      live = false;
    };
  }, [api, preview]);

  /* A result replaces the form, so focus goes to it. */
  useEffect(() => {
    if (!["form", "loading", "creating"].includes(phase)) statusRef.current?.focus();
  }, [phase]);

  /* Received but not confirmed, or not known: ask the server again for a
     while. Only the server's "captured" becomes success. */
  useEffect(() => {
    if (!DONATIONS_IN_BUILD || !order || (phase !== "authorized" && phase !== "unknown")) return undefined;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const state = await donationStatus(api, order.reference);
      if (state === "captured" || state === "failed") {
        clearInterval(timer);
        setPhase(state);
      } else if (tries >= POLL_TRIES) clearInterval(timer);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [api, order, phase]);

  /* A preview formats its placeholder amounts itself: "XXX" (no
     currency) is drawn differently by different ICU builds — "¤500.00"
     in Node, "XXX 500.00" in some browsers — and the prerendered text
     must match what the browser renders on hydration. */
  const exponent = config ? (preview ? preview.config.exponent : currencyExponent(config.currency)) : 2;
  const money = (minor) =>
    !config ? "" : preview ? previewMoney(minor, exponent, preview.config.symbol) : formatMoney(minor, config.currency);
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
    if (minor === null) return { error: m.amountFormat(exponent) };
    if (minor < config.min || minor > config.max)
      return { error: m.amountRange(money(config.min), money(config.max)) };
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
    if (attempted && config) setErrors((e) => ({ ...e, amount: amount().error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, other]);

  async function openCheckout(current) {
    if (!DONATIONS_IN_BUILD) return;
    setPhase("creating");
    const Razorpay = await loadCheckout();
    if (!Razorpay) {
      setNotice("error");
      setPhase("form");
      return;
    }
    let failed = false;
    const brand =
      getComputedStyle(document.documentElement).getPropertyValue("--color-trust-blue").trim() ||
      undefined;
    const checkout = new Razorpay({
      key: current.keyId,
      amount: current.amount,
      currency: current.currency,
      order_id: current.orderId,
      name: copy.checkoutName,
      description: copy.checkoutDescription,
      prefill: {
        name: values.name?.trim(),
        email: values.email?.trim(),
        ...(values.phone?.trim() && { contact: values.phone.trim() }),
      },
      ...(brand && { theme: { color: brand } }),
      /* Checkout's "paid" is a claim: the server verifies it. */
      handler: async (result) => {
        setPhase("verifying");
        const state = await verifyPayment(api, {
          reference: current.reference,
          orderId: result.razorpay_order_id,
          paymentId: result.razorpay_payment_id,
          signature: result.razorpay_signature,
        });
        setPhase(
          state === "captured"
            ? "captured"
            : state === "authorized" || state === "created"
              ? "authorized"
              : state === "failed"
                ? "failed"
                : "unknown"
        );
      },
      modal: {
        /* Closed without a successful payment. After a failed attempt the
           window stays open for another try, so "failed" is only decided
           here, when the donor gives up. */
        ondismiss: () => setPhase(failed ? "failed" : "cancelled"),
      },
    });
    checkout.on("payment.failed", () => {
      failed = true;
    });
    checkout.open();
    setPhase("checkout_opened");
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy.current) return;
    const found = validate();
    setErrors(found);
    setAttempted(true);
    setNotice(null);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    /* Preview: the checks above ran, and that is all. Nothing is sent. */
    if (preview || !DONATIONS_IN_BUILD) {
      setPhase("preview");
      return;
    }

    busy.current = true;
    attemptKey.current ??= newAttemptKey();
    setPhase("creating");
    const a = amount();
    const result = await createOrder(
      api,
      {
        amount: toDecimalString(a.minor, exponent),
        name: values.name.trim(),
        email: values.email.trim(),
        ...(values.phone?.trim() && { phone: values.phone.trim() }),
        [HONEYPOT_FIELD]: event.currentTarget.elements.namedItem(HONEYPOT_FIELD)?.value ?? "",
        elapsedMs: shownAt.current ? Date.now() - shownAt.current : null,
      },
      attemptKey.current
    );
    busy.current = false;

    if (result.outcome === "ok") {
      setOrder(result.order);
      await openCheckout(result.order);
      return;
    }
    setPhase("form");
    if (result.outcome === "invalid") {
      /* The server's codes, as this form's own messages. */
      const server = {};
      for (const [name, code] of Object.entries(result.fields ?? {}))
        server[name] =
          name === "amount"
            ? code === "format"
              ? m.amountFormat(exponent)
              : m.amountRange(money(config.min), money(config.max))
            : m[name] ?? m.name;
      setErrors(server);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } else {
      setNotice(result.outcome === "rate-limited" ? "rate-limited" : "error");
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  /* Start over with new details: a new attempt, a new order. */
  const change = () => {
    attemptKey.current = null;
    setOrder(null);
    setPhase("form");
  };

  /* One white card, square to the page, with the band's hard shadow: a
     payment form is trust-critical, so it is the calmest object on the
     page — no tilt, no watermark, nothing decorative inside it. */
  const card = "rounded-2xl border-rim bg-paper-white p-5 text-bumble-ink cast-lg sm:p-8";

  if (phase === "loading" || phase === "unavailable") {
    return (
      <div data-tone="card" className={card}>
        <noscript>
          <p className="font-medium">{copy.needsJavaScript}</p>
        </noscript>
        <p role="status" className="font-medium text-graphite">
          {phase === "loading" ? copy.loading : copy.unavailable}
        </p>
      </div>
    );
  }

  /* The test-mode line (Razorpay TEST keys) — or a preview badge, if
     content gives one. The preview itself is marked on the card as
     `data-donation-preview`, which release:check reads; nothing about it
     is shown to the visitor. */
  const badgeText = preview ? preview.badge : config?.mode === "test" ? copy.testMode : null;
  const testBadge = badgeText && (
    <p className="type-note mb-6 rounded-xl border-2 border-dashed border-trust-blue px-4 py-3 text-trust-blue">{badgeText}</p>
  );
  const previewMark = preview ? { "data-donation-preview": "" } : {};

  /* Every state after the form: one panel, focused when it appears. */
  const result = {
    checkout_opened: { text: copy.states.checkout_opened },
    verifying: { text: copy.states.verifying },
    captured: {
      ...copy.states.captured,
      body: order ? copy.states.captured.body(money(order.amount)) : "",
      tone: "success",
    },
    authorized: { ...copy.states.authorized, tone: "info" },
    cancelled: { ...copy.states.cancelled, tone: "info", retry: true },
    failed: { ...copy.states.failed, tone: "alert", retry: true },
    unknown: { ...copy.states.unknown, tone: "alert", contact: true },
    /* Not a payment state: the preview's own end, with a way back. */
    preview: preview && { ...preview.result, tone: "info", retry: true },
  }[phase];

  if (result) {
    return (
      <div data-tone="card" className={card} {...previewMark}>
        {testBadge}
        <div
          ref={statusRef}
          tabIndex={-1}
          role={result.tone === "alert" ? "alert" : "status"}
          aria-live={result.text ? "polite" : undefined}
          className={cx(
            "rounded-2xl outline-none",
            result.tone && "border-2 p-5 sm:p-6",
            result.tone === "success" && "border-growth-green",
            result.tone === "info" && "border-bumble-honey",
            result.tone === "alert" && "border-alert"
          )}
        >
          {result.text ? (
            <p className="font-semibold">{result.text}</p>
          ) : (
            <>
              <h3 className="type-card text-trust-blue">{result.heading}</h3>
              <p className="mt-2">{result.body}</p>
              {order && (
                <p className="mt-3 text-[length:var(--text-caption)] text-graphite">
                  {copy.reference}: <span className="font-mono font-semibold text-bumble-ink">{order.reference}</span>
                </p>
              )}
            </>
          )}
        </div>
        {(result.retry || result.contact) && (
          <div className="mt-6 flex flex-wrap gap-4">
            {result.retry && order && (
              <Button onClick={() => openCheckout(order)} className="whitespace-normal!">
                {copy.retry}
              </Button>
            )}
            {result.retry && (
              <Button onClick={change} variant="outline" className="whitespace-normal!">
                {copy.change}
              </Button>
            )}
            {result.contact && (
              <Button to={copy.contact.to} variant="outline" className="whitespace-normal!">
                {copy.contact.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* phase: form | creating */
  const submitting = phase === "creating";
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
          "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border-2 border-trust-blue/60 bg-paper-white px-3 py-3 text-center text-[19px] font-extrabold text-trust-blue",
          "transition duration-150 hover:border-trust-blue hover:bg-mist",
          "peer-checked:border-trust-blue peer-checked:bg-bumble-honey/15 peer-checked:shadow-[inset_0_0_0_1px_var(--color-trust-blue)]",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-night",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
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

  /* What the donor has chosen so far, for the line on the button — the
     same value `amount()` would send, or nothing. */
  const chosen = choice ? amount() : null;
  const summary = chosen && !chosen.error ? money(chosen.minor) : null;
  const fq = copy.frequency;
  /* A tile shows a whole amount without its zero fraction ("₹500", not
     "₹500.00") — it is a label to scan, not a total. The button and the
     summary keep the exact figure. */
  const tileMoney = (minor) => {
    const text = money(minor);
    return exponent && minor % 10 ** exponent === 0 ? text.replace(/[.,]0+(?=\D*$)/, "") : text;
  };
  /* With no presets the typed amount IS the amount control, so it takes
     the id the error summary links to. */
  const otherId = config.presets.length ? `${FORM_ID}-other` : `${FORM_ID}-amount`;

  /* A section label inside the card: small capitals, never a numbered
     step — the card reads as one short form, not a long procedure. */
  const LABEL = "type-meta block text-trust-blue";

  return (
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      aria-busy={submitting || undefined}
      aria-labelledby={`${FORM_ID}-heading`}
      data-tone="card"
      {...previewMark}
      className={cx("relative", card)}
    >
      <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={`${FORM_ID}-${HONEYPOT_FIELD}`}>{FORM_COPY.honeypotLabel}</label>
        <input
          id={`${FORM_ID}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* The trust head: a lock, the heading, and the one true sentence
          about where payment details go. Visual reassurance only. */}
      <div className="flex items-start gap-4 border-b-2 border-dashed border-hair pb-5">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-trust-blue text-paper-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 id={`${FORM_ID}-heading`} className="text-[22px] font-black leading-tight tracking-tight text-trust-blue">
            {copy.secureHeading}
          </h3>
          {copy.secureLine && <p className="mt-1 text-[15px] leading-snug text-graphite">{copy.secureLine}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-7">
        {testBadge && <div className="-mb-3">{testBadge}</div>}
        <FormSummary
          ref={summaryRef}
          heading={FORM_COPY.summaryHeading}
          errors={errors}
          fields={summaryFields}
          formId={FORM_ID}
        />
        {notice && (
          <p ref={statusRef} tabIndex={-1} role="alert" className="rounded-2xl border-2 border-alert bg-paper-white p-5 font-semibold text-bumble-ink">
            {notice === "rate-limited" ? copy.rateLimited : copy.error}
          </p>
        )}

        {/* Frequency. Real radios in a fieldset, so arrow keys move between
            them and a screen reader hears the group's name. Monthly is
            DISABLED, not hidden — recurring giving is not offered — and its
            note says so in words. Nothing here is sent to the server: the
            order the server makes is one-time, as it always was. */}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={LABEL}>{fq.legend}</legend>
          <div className={cx("mt-3 grid gap-1 rounded-xl border-2 border-trust-blue bg-mist p-1", fq.monthly ? "grid-cols-2" : "grid-cols-1")}>
            <label className="relative block cursor-pointer">
              <input type="radio" name="frequency" value="once" defaultChecked className="peer sr-only" />
              <span className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-center font-extrabold text-trust-blue peer-checked:bg-trust-blue peer-checked:text-paper-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-night">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
                  <path d="m5 12 5 5 9-10" />
                </svg>
                {fq.once}
              </span>
            </label>
            {/* Monthly only exists if content offers it (recurring giving
                is not offered — Document 22). */}
            {fq.monthly && (
            <label className="relative block cursor-not-allowed">
              <input type="radio" name="frequency" value="monthly" disabled aria-describedby={`${FORM_ID}-monthly-note`} className="peer sr-only" />
              <span className="flex min-h-12 flex-col items-center justify-center rounded-lg px-3 text-center leading-tight text-graphite">
                <span className="font-extrabold">{fq.monthly}</span>
                <span id={`${FORM_ID}-monthly-note`} className="text-[13px] font-medium">
                  {fq.monthlyNote}
                </span>
              </span>
            </label>
            )}
          </div>
        </fieldset>

        {/* Amount: the server's approved presets, then the typed amount.
            ONE amount is ever chosen — `choice` is a preset or "other",
            and "other" means the field below. */}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={LABEL}>
            {preview?.amountLegend ?? copy.amountLegend} <span className="font-medium normal-case tracking-normal text-graphite">({FORM_COPY.required})</span>
          </legend>
          <FieldError id={amountError ? `${FORM_ID}-amount-error` : null} prefix={FORM_COPY.errorPrefix}>
            {amountError}
          </FieldError>
          {config.presets.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 min-[400px]:grid-cols-3">
              {config.presets.map((minor, i) => radio(String(minor), tileMoney(minor), i === 0))}
            </div>
          )}

          {config.custom && (
            <div className={config.presets.length ? "mt-4" : "mt-3"}>
              <label htmlFor={otherId} className="block font-bold text-trust-blue">
                {config.presets.length ? copy.otherAmount : copy.otherLabel}
              </label>
              <p id={`${FORM_ID}-other-hint`} className="mt-0.5 text-[15px] text-graphite">
                {(preview?.otherHint ?? copy.otherHint)(money(config.min), money(config.max))}
              </p>
              {/* The currency sits INSIDE the field's right edge, as text the
                  field is labelled with — the same code the server will use. */}
              <div className="relative mt-2">
                <input
                  id={otherId}
                  type="text"
                  inputMode={exponent ? "decimal" : "numeric"}
                  autoComplete="off"
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setChoice(e.target.value ? "other" : "");
                  }}
                  onFocus={() => other && setChoice("other")}
                  disabled={submitting}
                  aria-invalid={amountError && choice === "other" ? true : undefined}
                  aria-describedby={cx(`${FORM_ID}-other-hint`, amountError && `${FORM_ID}-amount-error`)}
                  className={cx(CONTROL, "pr-16 text-[20px] font-bold", choice === "other" && "border-trust-blue bg-bumble-honey/10")}
                />
                {(config.currencyLabel ?? config.currency) && (
                  <span aria-hidden="true" className="type-meta pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-graphite">
                    {config.currencyLabel ?? config.currency}
                  </span>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {/* The donor: the three fields the server accepts, nothing more. */}
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

        {/* The action. Its label states what happens next — the payment
            window opens — and repeats the amount, so the donor sees what
            they are about to give on the control that gives it. Guarded
            against a second press (SubmitButton, and `busy` in onSubmit). */}
        <div className="grid gap-3 border-t-2 border-dashed border-hair pt-6">
          <SubmitButton busy={submitting} busyLabel={copy.submitting} disabled={Boolean(preview) && !hydrated} block>
            <span>{copy.submit}</span>
            {summary && (
              <>
                {" "}
                <span className="font-black">· {summary}</span>
              </>
            )}
          </SubmitButton>
          {!summary && <p className="text-center text-[15px] text-graphite">{copy.summaryEmpty}</p>}
          {submitting && (
            <p role="status" className="text-center font-medium text-graphite">
              {copy.submitting}
            </p>
          )}
          {privacy && (
            <p className="text-center text-[15px] text-graphite">
              <Link to={privacy.to} className="font-semibold text-trust-blue underline underline-offset-4">
                {privacy.label}
              </Link>
            </p>
          )}
        </div>

        {/* Help: only routes that exist and are true (content/donation.js).
            No tax, receipt, recurring or refund question until RBB has an
            approved answer to link to. */}
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
