import { cx } from "../../lib/cx.js";
import { CONTROL } from "../TextInput/TextInput.jsx";

/* A multi-line TextInput. Resizes vertically only, so it never pushes the
   layout sideways on a phone. */
export default function Textarea({ rows = 6, className = "", ...rest }) {
  return <textarea rows={rows} className={cx(CONTROL, "resize-y", className)} {...rest} />;
}
