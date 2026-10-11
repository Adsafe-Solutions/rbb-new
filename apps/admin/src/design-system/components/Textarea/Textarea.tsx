import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "../../utils";
import { useFieldProps } from "../FormField/FormField";
import control from "../Input/control.module.css";
import styles from "./Textarea.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, rows = 4, ...rest }, ref) {
  const props = useFieldProps(rest, invalid);
  return <textarea ref={ref} rows={rows} className={cx(control.control, styles.textarea, className)} {...props} />;
});
