/* One field's error, under its label and above its control, tied to the
   control by `aria-describedby`. "Error:" is spoken and the icon shown,
   so the message never depends on its colour. */
export default function FieldError({ id, prefix, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 font-medium text-alert">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 fill-current">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" />
      </svg>
      <span>
        <span className="sr-only">{prefix} </span>
        {children}
      </span>
    </p>
  );
}
