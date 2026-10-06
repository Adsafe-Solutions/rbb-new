import Button from "../Button/Button.jsx";

/* The form's one filled button — the primary, full width, large. While submitting it stays in place and
   focusable but does nothing — `aria-disabled`, not `disabled`, so focus
   is not thrown to <body> mid-submit — and says so in its label. The
   form refuses a second submit on its own as well (FormShell).
   `disabled` is for a form that must not submit natively at all — the
   donation preview before hydration: a disabled default button also
   stops Enter in a field from submitting the form. */
export default function SubmitButton({ busy, busyLabel, block = false, disabled, children }) {
  return (
    <Button
      type="submit"
      disabled={disabled || undefined}
      aria-disabled={busy || undefined}
      size="lg"
      /* `block`: full width at every size — the donation form's one action. */
      className={
        block
          ? "w-full whitespace-normal! aria-disabled:cursor-wait aria-disabled:opacity-70"
          : "w-full whitespace-normal! aria-disabled:cursor-wait aria-disabled:opacity-70 sm:w-auto sm:self-start"
      }
    >
      {busy ? busyLabel : children}
    </Button>
  );
}
