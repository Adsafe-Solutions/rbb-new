import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import FormField from "../FormField/FormField.jsx";
import FieldError from "../FieldError/FieldError.jsx";
import { cx } from "../../lib/cx.js";
import FormSummary from "../FormSummary/FormSummary.jsx";
import SubmitButton from "../SubmitButton/SubmitButton.jsx";
import SubmissionStatus from "../SubmissionStatus/SubmissionStatus.jsx";
import { FORM_COPY } from "../../content/index.js";
import {
  formFields,
  formState,
  newSubmissionKey,
  serverFieldMessage,
  submitForm,
  validateField,
  validateForm,
} from "../../lib/forms.js";
import { HONEYPOT_FIELD } from "../../lib/formSchema.js";

/* One form, driven by its config (content/forms.js), through Document
   12's states:

     disabled    no fields at all — `fallback` renders instead (the page's
                 existing pending line), or nothing
     ready       the approved fields, validated on submit and then per
                 field as they are corrected
     submitting  one request in flight; further submits are ignored
     success     RBB's success text replaces the form, and takes focus
     error       RBB's error text above the form, which keeps what was
                 typed so nothing has to be entered twice; the retry
                 reuses the same idempotency key
     rate-limited  the generic "please wait" line, same treatment
   A server-side validation failure returns to "ready" with the server's
   field codes shown as this form's own messages (Document 21).

   Without JavaScript the pre-rendered form stays DISABLED, with a line
   saying so: it is sent by script, and a plain HTML submit would put the
   visitor's details in the page's URL. It becomes usable once hydrated.

   The honeypot is an off-screen field hidden from assistive technology
   and out of the tab order; the server discards anything that fills it
   (and anything submitted impossibly fast — `elapsedMs`). Neither is a
   security boundary: the server's rate limit is.

   `alternative` is a verified contact route ({ label, href }) shown with
   the error, when one exists (content/contact.js). */
/* The send glyph for the inline layout's icon button. */
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

/* layout="inline" — the newsletter card's design (components/Newsletter):
   the email address and a Growth Green send button in ONE rounded field,
   the consent box beneath. Same form in every other respect: the same
   validation, messages, honeypot, fill time, server submission and
   states. The email's label is kept for assistive technology (visually
   hidden, as the design has none) and the field shows the placeholder
   `field.placeholder`; the send button is named by `submitLabel`. */
function InlineEmail({ formId, field, value, error, onChange, onBlur, submitting, submitLabel, busyLabel }) {
  const id = `${formId}-${field.name}`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <FieldError id={errorId} prefix={FORM_COPY.errorPrefix}>{error}</FieldError>
      <div
        className={cx(
          "flex items-center gap-3 rounded-2xl border bg-paper-white p-2 pl-6 focus-within:border-bumble-ink",
          error ? "mt-3 border-2 border-alert" : "border-bumble-ink/45"
        )}
      >
        <label htmlFor={id} className="sr-only">
          {field.label}
        </label>
        <input
          id={id}
          name={field.name}
          type="email"
          required
          autoComplete={field.autoComplete}
          maxLength={field.maxLength}
          spellCheck={false}
          placeholder={field.placeholder}
          value={value ?? ""}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(e) => onChange(field.name, e.target.value)}
          onBlur={() => onBlur(field.name)}
          className="min-w-0 flex-1 bg-transparent py-3 text-bumble-ink outline-none placeholder:text-graphite"
        />
        <button
          type="submit"
          aria-label={submitting ? busyLabel : submitLabel}
          aria-disabled={submitting || undefined}
          className={cx(
            "grid h-14 w-16 shrink-0 cursor-pointer place-items-center rounded-2xl",
            "bg-growth-green text-bumble-ink transition-colors hover:bg-trust-blue hover:text-paper-white",
            "aria-disabled:cursor-wait aria-disabled:opacity-70"
          )}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

export default function FormShell({
  config,
  fallback = null,
  alternative,
  className = "",
  layout = "stack",
}) {
  const ready = formState(config) === "ready";
  const fields = ready ? formFields(config) : [];

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState("ready");
  const [attempted, setAttempted] = useState(false);
  const busy = useRef(false);
  const key = useRef(null);
  const summaryRef = useRef(null);
  const statusRef = useRef(null);
  const shownAt = useRef(null);
  const [live, setLive] = useState(false);

  /* Hydrated: the form can now be sent, and the fill clock starts. */
  useEffect(() => {
    shownAt.current = Date.now();
    setLive(true);
  }, []);

  useEffect(() => {
    if (status === "success" || status === "error" || status === "rate-limited")
      statusRef.current?.focus();
  }, [status]);

  if (!ready) return fallback;

  const update = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    /* Once a field has shown an error, re-check it as it is corrected,
       so the message clears the moment it no longer applies. */
    if (touched[name] || attempted) {
      const field = fields.find((f) => f.name === name);
      setErrors((e) => ({ ...e, [name]: validateField(field, value) }));
    }
  };

  const blur = (name) => {
    if (!attempted) return;
    setTouched((t) => ({ ...t, [name]: true }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy.current) return;

    const found = validateForm(fields, values);
    setErrors(found);
    setAttempted(true);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    busy.current = true;
    key.current ??= newSubmissionKey();
    setStatus("submitting");
    const result = await submitForm(config, values, key.current, {
      /* Read from the field itself at submit time, not tracked through
         onChange: autofill and scripted fillers set the value without the
         events React listens for, and those are exactly what it catches. */
      honeypot: event.currentTarget.elements.namedItem(HONEYPOT_FIELD)?.value ?? "",
      elapsedMs: shownAt.current ? Date.now() - shownAt.current : null,
    });
    busy.current = false;
    if (result.outcome === "ok") {
      key.current = null;
      setValues({});
      setStatus("success");
    } else if (result.outcome === "invalid") {
      /* The server disagreed with the browser's checks: show its field
         codes as this form's messages, exactly like a browser-side error. */
      const serverErrors = {};
      for (const field of fields) {
        const code = result.fields?.[field.name];
        if (code) serverErrors[field.name] = serverFieldMessage(field, code);
      }
      setErrors(serverErrors);
      setStatus("ready");
      requestAnimationFrame(() => summaryRef.current?.focus());
    } else {
      setStatus(result.outcome === "rate-limited" ? "rate-limited" : "error");
    }
  };

  if (status === "success") {
    return (
      <div className={className}>
        <SubmissionStatus
          ref={statusRef}
          state="success"
          message={config.successMessage}
        />
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      aria-busy={submitting || undefined}
      className={`relative ${className}`}
    >
      <noscript>
        <p className="mb-6 rounded-2xl bg-mist px-5 py-4 font-medium text-bumble-ink">
          {FORM_COPY.needsJavaScript}
        </p>
      </noscript>
      {/* Off screen, unlabelled for assistive technology, out of the tab
          order — only an automated filler sees it. */}
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden"
      >
        <label htmlFor={`${config.formId}-${HONEYPOT_FIELD}`}>
          {FORM_COPY.honeypotLabel}
        </label>
        <input
          id={`${config.formId}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <fieldset disabled={!live} className="m-0 min-w-0 border-0 p-0">
        <div className="grid gap-6">
          <FormSummary
            ref={summaryRef}
            heading={FORM_COPY.summaryHeading}
            errors={errors}
            fields={fields}
            formId={config.formId}
          />
          {(status === "error" || status === "rate-limited") && (
            <SubmissionStatus
              ref={statusRef}
              state="error"
              message={
                status === "rate-limited" ? FORM_COPY.rateLimited : config.errorMessage
              }
              alternative={alternative}
              alternativeLead={FORM_COPY.alternativeLead}
            />
          )}

          {fields.map((field) =>
            layout === "inline" && field.type === "email" ? (
              <InlineEmail
                key={field.name}
                formId={config.formId}
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={update}
                onBlur={blur}
                submitting={submitting}
                submitLabel={config.submitLabel}
                busyLabel={FORM_COPY.submitting}
              />
            ) : (
            <FormField
              key={field.name}
              formId={config.formId}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={update}
              onBlur={blur}
              disabled={submitting}
              copy={FORM_COPY}
            />
            )
          )}

          {config.privacyLink?.to && (
            <p className="text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
              <Link
                to={config.privacyLink.to}
                className="font-semibold text-trust-blue underline underline-offset-4"
              >
                {config.privacyLink.label}
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-4">
            {layout !== "inline" && (
              <SubmitButton busy={submitting} busyLabel={FORM_COPY.submitting}>
                {config.submitLabel}
              </SubmitButton>
            )}
            <SubmissionStatus
              state={submitting ? "submitting" : null}
              message={FORM_COPY.submittingStatus}
            />
          </div>
        </div>
      </fieldset>
    </form>
  );
}
