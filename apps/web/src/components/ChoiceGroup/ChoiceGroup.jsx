/* The options of a "choose one" (radio) or "choose any" (checkboxes)
   field: one row per option, each the native control and its clickable
   label, printed like CheckboxField (the same white row, hairline border
   and Deep Trust Blue edge once chosen) so a form's tick boxes all look
   alike. The group's question, hint and error belong to the <fieldset>
   and <legend> FormField wraps around this — a radio group named only by
   its options' labels would be read as unrelated answers.

   `id` goes on the FIRST option: the error summary links to a field by
   that id (components/FormSummary) and moves focus there, which for a
   group means into it. The other options take `<id>-<n>`.

   type="radio"       value is the chosen option, or ""
   type="checkbox"    value is an ARRAY of the chosen options, kept in the
                      options' own order whatever order they were ticked */
export default function ChoiceGroup({ id, name, type, options, value, onChange, onBlur, disabled, required, invalid }) {
  const chosen = type === "checkbox" ? (Array.isArray(value) ? value : []) : null;
  const toggle = (option, checked) =>
    onChange(options.filter((o) => (o.value === option ? checked : chosen.includes(o.value))).map((o) => o.value));

  return (
    <div className="grid gap-3">
      {options.map((option, i) => {
        const optionId = i === 0 ? id : `${id}-${i + 1}`;
        return (
          <div key={option.value} className="flex items-start gap-3 rounded-xl border-2 border-hair bg-paper-white p-4 has-[:checked]:border-trust-blue">
            <input
              id={optionId}
              type={type}
              name={name}
              value={option.value}
              checked={type === "checkbox" ? chosen.includes(option.value) : value === option.value}
              onChange={(e) => (type === "checkbox" ? toggle(option.value, e.target.checked) : onChange(option.value))}
              onBlur={onBlur}
              disabled={disabled}
              /* A radio group is answered by any one of its radios, so each
                 carries `required`; a "choose any" group is not a set of
                 required boxes, so none does — the legend says it in words. */
              required={type === "radio" && required ? true : undefined}
              aria-invalid={invalid || undefined}
              className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-trust-blue"
            />
            <label htmlFor={optionId} className="cursor-pointer text-bumble-ink">
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}
