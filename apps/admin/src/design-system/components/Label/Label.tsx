import type { LabelHTMLAttributes } from "react";
import { cx } from "../../utils";
import styles from "./Label.module.css";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a required marker. The control's own `required` attribute is
   * what screen readers announce, so the marker is hidden from them. */
  required?: boolean;
  disabled?: boolean;
}

export function Label({ required, disabled, className, children, ...rest }: LabelProps) {
  return (
    <label className={cx(styles.label, disabled && styles.disabled, className)} {...rest}>
      {children}
      {required && (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
