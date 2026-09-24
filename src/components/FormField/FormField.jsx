import TextInput from "../TextInput/TextInput.jsx";
import Textarea from "../Textarea/Textarea.jsx";
import SelectField from "../SelectField/SelectField.jsx";
import CheckboxField from "../CheckboxField/CheckboxField.jsx";
import FieldError from "../FieldError/FieldError.jsx";

/* One field from a form config (content/forms.js): its visible label,
   whether it is required — said in words, not an asterisk — an optional
   hint, the error if there is one, and the right control.

   Wiring: the label's `for` is the control's id; `aria-describedby`
   lists the hint and the error; `aria-invalid` marks the control while it
   has an error; `required` is the native attribute, so assistive
   technology announces it. The form itself sets `noValidate`, so the
   browser's own bubbles do not compete with these messages. */
export default function FormField({ formId, field, value, error, onChange, onBlur, disabled, copy }) {
  const id = `${formId}-${field.name}`;
  const hintId = field.hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    name: field.name,
    required: field.required || undefined,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onBlur: () => onBlur(field.name),
  };

  if (field.type === "checkbox") {
    return (
      <div>
        <FieldError id={errorId} prefix={copy.errorPrefix}>{error}</FieldError>
        <div className={error ? "mt-3" : undefined}>
          <CheckboxField
            {...shared}
            label={field.label}
            required={field.required}
            requiredText={copy.required}
            checked={Boolean(value)}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
        </div>
      </div>
    );
  }

  const control = { ...shared, value: value ?? "", onChange: (e) => onChange(field.name, e.target.value) };

  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-bumble-ink">
        {field.label}{" "}
        <span className="font-normal text-graphite">({field.required ? copy.required : copy.optional})</span>
      </label>
      {field.hint && (
        <p id={hintId} className="mt-1 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
          {field.hint}
        </p>
      )}
      <FieldError id={errorId} prefix={copy.errorPrefix}>{error}</FieldError>
      <div className="mt-2">
        {field.type === "textarea" ? (
          <Textarea {...control} maxLength={field.maxLength} />
        ) : field.type === "select" ? (
          <SelectField {...control} options={field.options} placeholder={copy.selectNone} />
        ) : (
          <TextInput
            {...control}
            type={field.type === "email" ? "email" : "text"}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            spellCheck={field.type === "email" ? false : undefined}
          />
        )}
      </div>
    </div>
  );
}
