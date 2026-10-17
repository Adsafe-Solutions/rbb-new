import TextInput from "../TextInput/TextInput.jsx";
import Textarea from "../Textarea/Textarea.jsx";
import SelectField from "../SelectField/SelectField.jsx";
import CheckboxField from "../CheckboxField/CheckboxField.jsx";
import FieldError from "../FieldError/FieldError.jsx";
import FileField from "../FileField/FileField.jsx";
import ChoiceGroup from "../ChoiceGroup/ChoiceGroup.jsx";

/* One field from a form config (content/forms.js): its visible label,
   whether it is required — said in words, not an asterisk — an optional
   hint, the error if there is one, and the right control.

   Wiring: the label's `for` is the control's id; `aria-describedby`
   lists the hint and the error; `aria-invalid` marks the control while it
   has an error; `required` is the native attribute, so assistive
   technology announces it. The form itself sets `noValidate`, so the
   browser's own bubbles do not compete with these messages.

   A "choose one" (radio) or "choose any" (checkboxes) field is a group:
   a <fieldset> whose <legend> is the question, with the hint and the
   error described on the fieldset — each option keeps its own <label>.

   A number is a native number box (whole numbers, its min and max); a
   date the browser's own date picker, whose value is "YYYY-MM-DD" — the
   shape the API takes. */

/* The field's place in the form, stamped like a step number, then its
   question and whether it is required — the same for a label and a
   legend. Decoration: the label is the field's name. */
function Caption({ field, number, copy }) {
  return (
    <>
      {number != null && (
        <span aria-hidden="true" className="type-meta rounded-md bg-pop px-1.5 py-0.5 text-on-pop">
          {String(number).padStart(2, "0")}
        </span>
      )}
      <span>
        {field.label} <span className="font-normal text-quiet">({field.required ? copy.required : copy.optional})</span>
      </span>
    </>
  );
}

export default function FormField({ formId, field, value, error, onChange, onBlur, disabled, copy, number }) {
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

  if (field.type === "radio" || field.type === "checkboxes") {
    return (
      <fieldset aria-describedby={describedBy} className="m-0 min-w-0 border-0 p-0">
        {/* The flex row is on a span inside: a <legend> is laid out by
            rules of its own, and not every browser lets it be a flexbox. */}
        <legend className="p-0 font-bold text-fg">
          <span className="flex items-baseline gap-2.5">
            <Caption field={field} number={number} copy={copy} />
          </span>
        </legend>
        {field.hint && (
          <p id={hintId} className="mt-1 text-[15px] leading-snug text-quiet">
            {field.hint}
          </p>
        )}
        <FieldError id={errorId} prefix={copy.errorPrefix}>{error}</FieldError>
        <div className="mt-3">
          <ChoiceGroup
            id={id}
            name={field.name}
            type={field.type === "radio" ? "radio" : "checkbox"}
            options={field.options}
            value={value}
            onChange={(next) => onChange(field.name, next)}
            onBlur={shared.onBlur}
            disabled={disabled}
            required={field.required}
            invalid={Boolean(error)}
          />
        </div>
      </fieldset>
    );
  }

  const control = { ...shared, value: value ?? "", onChange: (e) => onChange(field.name, e.target.value) };

  return (
    <div>
      <label htmlFor={id} className="flex items-baseline gap-2.5 font-bold text-fg">
        <Caption field={field} number={number} copy={copy} />
      </label>
      {field.hint && (
        <p id={hintId} className="mt-1 text-[15px] leading-snug text-quiet">
          {field.hint}
        </p>
      )}
      <FieldError id={errorId} prefix={copy.errorPrefix}>{error}</FieldError>
      <div className="mt-2">
        {field.type === "file" ? (
          <FileField id={id} field={field} value={value} onChange={onChange} disabled={disabled} copy={copy} describedBy={describedBy} invalid={Boolean(error)} />
        ) : field.type === "textarea" ? (
          <Textarea {...control} maxLength={field.maxLength} />
        ) : field.type === "select" ? (
          <SelectField {...control} options={field.options} placeholder={copy.selectNone} />
        ) : field.type === "number" ? (
          <TextInput
            {...control}
            type="number"
            step={1}
            min={field.min}
            max={field.max}
            /* The digits-only keypad has no minus sign on most phones, so
               it is asked for only when an answer cannot be negative. */
            inputMode={field.min != null && field.min >= 0 ? "numeric" : undefined}
            placeholder={field.placeholder}
          />
        ) : field.type === "date" ? (
          <TextInput {...control} type="date" />
        ) : (
          <TextInput
            {...control}
            type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            spellCheck={field.type === "email" ? false : undefined}
          />
        )}
      </div>
    </div>
  );
}
