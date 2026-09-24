import { cx } from "../../lib/cx.js";

/* The site's one text box — also the base Textarea and SelectField share.
   A visible border (Charcoal at 45% clears 3:1 against white, as a
   control boundary must), the alert border when `aria-invalid`, and the
   site's own focus ring. Labels come from FormField: this is the control
   alone, and a placeholder never stands in for a label. */
export const CONTROL = cx(
  "block w-full min-w-0 rounded-2xl border border-bumble-ink/45 bg-paper-white px-4 py-3",
  "text-[length:var(--text-body)] text-bumble-ink",
  "aria-[invalid=true]:border-2 aria-[invalid=true]:border-alert",
  "disabled:cursor-not-allowed disabled:opacity-60"
);

export default function TextInput({ type = "text", className = "", ...rest }) {
  return <input type={type} className={cx(CONTROL, className)} {...rest} />;
}
