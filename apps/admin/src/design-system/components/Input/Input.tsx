import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils";
import { useFieldProps } from "../FormField/FormField";
import control from "./control.module.css";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  /** An icon inside the start of the field (decorative). */
  leadingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ size = "md", invalid, leadingIcon, className, ...rest }, ref) {
  const props = useFieldProps(rest, invalid);
  const input = <input ref={ref} className={cx(control.control, styles.input, styles[size], Boolean(leadingIcon) && styles.withIcon, className)} {...props} />;
  if (!leadingIcon) return input;
  return (
    <span className={styles.wrap}>
      <span className={styles.icon}>{leadingIcon}</span>
      {input}
    </span>
  );
});
