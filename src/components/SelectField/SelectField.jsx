import { cx } from "../../lib/cx.js";
import { CONTROL } from "../TextInput/TextInput.jsx";

/* A native <select> — the browser's own keyboard and screen-reader
   behaviour, nothing re-implemented. The first, empty option is "not
   chosen", which is what an optional select should mean; its label
   (`placeholder`) comes from FORM_COPY.selectNone. */
export default function SelectField({ options, placeholder, className = "", ...rest }) {
  return (
    <div className="relative">
      <select className={cx(CONTROL, "appearance-none pr-12", className)} {...rest}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-trust-blue"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
