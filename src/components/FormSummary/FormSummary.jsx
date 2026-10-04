import { forwardRef } from "react";

/* The list of what to fix, shown above the form after a submit that did
   not validate. It takes focus (the form moves it here), so a screen
   reader hears the heading and the count at once; each entry links to its
   field. The messages are the fields' own — never what was typed. */
const FormSummary = forwardRef(function FormSummary({ heading, errors, fields, formId }, ref) {
  const entries = fields.filter((f) => errors[f.name]);
  if (entries.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${formId}-summary`}
      className="rounded-2xl border-2 border-alert bg-paper-white p-5 shadow-[6px_6px_0_color-mix(in_srgb,var(--color-alert)_25%,transparent)] sm:p-6"
    >
      <h3 id={`${formId}-summary`} className="font-bold text-alert">
        {heading}
      </h3>
      <ul className="mt-3 grid gap-2">
        {entries.map((field) => (
          <li key={field.name}>
            <a
              href={`#${formId}-${field.name}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`${formId}-${field.name}`)?.focus();
              }}
              className="font-medium text-alert underline underline-offset-4"
            >
              {errors[field.name]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default FormSummary;
