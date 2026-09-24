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
import { ENV } from "../../config/env.js";
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
   this bundle. Copy: DONATION.donationAction.checkout (PROPOSED). */
const FORM_ID = "donation";
const POLL_MS = 5000;
const POLL_TRIES = 12;
const PHONE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

export default function DonationCheckout({ copy }) {
  const api = ENV.donationsApi;
  const privacy = policyLink("privacy");

  const [phase, setPhase] = useState("loading");
  const [config, setConfig] = useState(null);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState(null); // "error" | "rate-limited"
  const [order, setOrder] = useState(null);

  const busy = useRef(false);
  const attemptKey = useRef(null);
  const shownAt = useRef(null);
  const summaryRef = useRef(null);
  const statusRef = useRef(null);

  /* Hydrated: ask the server what may be given. */
  useEffect(() => {
    let live = true;
    shownAt.current = Date.now();
    donationConfig(api).then((c) => {
      if (!live) return;
      setConfig(c);
      setPhase(c ? "form" : "unavailable");
    });
    return () => {
      live = false;
    };
  }, [api]);

  /* A result replaces the form, so focus goes to it. */
  useEffect(() => {
    if (!["form", "loading", "creating"].includes(phase)) statusRef.current?.focus();
  }, [phase]);

  /* Received but not confirmed, or not known: ask the server again for a
     while. Only the server's "captured" becomes success. */
  useEffect(() => {
    if (!order || (phase !== "authorized" && phase !== "unknown")) return undefined;
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

  const exponent = config ? currencyExponent(config.currency) : 2;
  const money = (minor) => (config ? formatMoney(minor, config.currency) : "");
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

  const card = "mt-8 rounded-3xl bg-paper-white p-6 text-bumble-ink sm:p-8";

  if (phase === "loading" || phase === "unavailable") {
    return (
      <div className={card}>
        <noscript>
          <p className="font-medium">{copy.needsJavaScript}</p>
        </noscript>
        <p role="status" className="font-medium text-graphite">
          {phase === "loading" ? copy.loading : copy.unavailable}
        </p>
      </div>
    );
  }

  const testBadge = config?.mode === "test" && (
    <p className="mb-6 rounded-2xl border-2 border-dashed border-trust-blue/40 bg-mist px-4 py-3 font-semibold text-trust-blue">
      {copy.testMode}
    </p>
  );

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
  }[phase];

  if (result) {
    return (
      <div className={card}>
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
              <h3 className="text-[length:var(--text-subheading)] font-bold text-trust-blue">{result.heading}</h3>
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
  const radio = (value, label, first) => (
    <label key={value} className="relative block cursor-pointer">
      <input
        id={first ? `${FORM_ID}-amount` : undefined}
        type="radio"
        name="amount"
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
        disabled={submitting}
        aria-describedby={amountError ? `${FORM_ID}-amount-error` : undefined}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex min-h-12 items-center justify-center rounded-2xl border border-bumble-ink/45 px-4 py-3 text-center font-semibold",
          "peer-checked:border-trust-blue peer-checked:bg-trust-blue peer-checked:text-paper-white",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-bumble-ink",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        )}
      >
        {label}
      </span>
    </label>
  );

  return (
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      aria-busy={submitting || undefined}
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
      {testBadge}
      <div className="grid gap-6">
        <FormSummary
          ref={summaryRef}
          heading={FORM_COPY.summaryHeading}
          errors={errors}
          fields={summaryFields}
          formId={FORM_ID}
        />
        {notice && (
          <p ref={statusRef} tabIndex={-1} role="alert" className="rounded-2xl border-2 border-alert p-5 font-semibold">
            {notice === "rate-limited" ? copy.rateLimited : copy.error}
          </p>
        )}

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="font-semibold">
            {copy.amountLegend} <span className="font-normal text-graphite">({FORM_COPY.required})</span>
          </legend>
          <FieldError id={amountError ? `${FORM_ID}-amount-error` : null} prefix={FORM_COPY.errorPrefix}>
            {amountError}
          </FieldError>
          <div className="mt-3 grid grid-cols-2 gap-tiles sm:grid-cols-3">
            {config.presets.map((minor, i) => radio(String(minor), money(minor), i === 0))}
            {config.custom && radio("other", copy.otherAmount, config.presets.length === 0)}
          </div>
          {config.custom && choice === "other" && (
            <div className="mt-4">
              <label htmlFor={`${FORM_ID}-other`} className="block font-semibold">
                {copy.otherLabel} ({config.currency})
              </label>
              <p id={`${FORM_ID}-other-hint`} className="mt-1 text-[length:var(--text-caption)] text-graphite">
                {copy.otherHint(money(config.min), money(config.max))}
              </p>
              <input
                id={`${FORM_ID}-other`}
                type="text"
                inputMode={exponent ? "decimal" : "numeric"}
                autoComplete="off"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                disabled={submitting}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={cx(`${FORM_ID}-other-hint`, amountError && `${FORM_ID}-amount-error`)}
                className={cx(CONTROL, "mt-2 max-w-xs")}
              />
            </div>
          )}
        </fieldset>

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

        {privacy && (
          <p className="text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
            <Link to={privacy.to} className="font-semibold text-trust-blue underline underline-offset-4">
              {privacy.label}
            </Link>
          </p>
        )}

        <div className="flex flex-col gap-4">
          <SubmitButton busy={submitting} busyLabel={copy.submitting}>
            {copy.submit}
          </SubmitButton>
          {submitting && (
            <p role="status" className="font-medium text-graphite">
              {copy.submitting}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
