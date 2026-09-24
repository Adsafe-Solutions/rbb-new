import Button from "../Button/Button.jsx";

/* The form's one green button. While submitting it stays in place and
   focusable but does nothing — `aria-disabled`, not `disabled`, so focus
   is not thrown to <body> mid-submit — and says so in its label. The
   form refuses a second submit on its own as well (FormShell). */
export default function SubmitButton({ busy, busyLabel, children }) {
  return (
    <Button
      type="submit"
      aria-disabled={busy || undefined}
      className="self-start whitespace-normal! aria-disabled:cursor-wait aria-disabled:opacity-70"
    >
      {busy ? busyLabel : children}
    </Button>
  );
}
