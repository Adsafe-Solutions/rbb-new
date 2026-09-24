/* A checkbox and its label, side by side, the label clickable. Used for
   consent — and ONLY with wording RBB has approved (content/forms.js).
   The box is the native one, enlarged, so keyboard, focus and state are
   the browser's. */
export default function CheckboxField({ id, label, required, requiredText, ...rest }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-trust-blue"
        {...rest}
      />
      <label htmlFor={id} className="cursor-pointer text-bumble-ink">
        {label}
        {required && <span className="text-graphite"> ({requiredText})</span>}
      </label>
    </div>
  );
}
