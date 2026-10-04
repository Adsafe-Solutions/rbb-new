import { cx } from "../../lib/cx.js";

/* The site's one text box — also the base Textarea and SelectField share.
   A white field with the system's 2px Deep Trust Blue border (9.9:1
   against white, well over the 3:1 a control boundary needs), the alert
   border when `aria-invalid`, and the site's own focus ring — Night, 3px,
   outside the border, never the accent (a Sky Blue ring disappears on a
   Sky Blue band). Labels come from FormField: this is the control
   alone, and a placeholder never stands in for a label. */
export const CONTROL = cx(
  "block w-full min-w-0 rounded-xl border-2 border-trust-blue bg-paper-white px-4 py-3.5",
  "text-[length:var(--text-body)] text-bumble-ink placeholder:text-graphite",
  "transition-shadow duration-200 focus:shadow-[4px_4px_0_var(--color-bumble-honey)]",
  "aria-[invalid=true]:border-alert aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-alert)_18%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-60"
);

export default function TextInput({ type = "text", className = "", ...rest }) {
  return <input type={type} className={cx(CONTROL, className)} {...rest} />;
}
