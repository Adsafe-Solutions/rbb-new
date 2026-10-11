import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "../../icons";
import { cx } from "../../utils";
import { useFieldProps } from "../FormField/FormField";
import control from "../Input/control.module.css";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: SelectOption[];
  /** A first, empty choice such as "Choose a status". */
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
}

/* The native <select>: the platform's keyboard handling, type-ahead,
   mobile pickers and screen-reader support, styled to match. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, placeholder, size = "md", invalid, className, ...rest }, ref) {
  const props = useFieldProps(rest, invalid);
  return (
    <span className={styles.wrap}>
      <select ref={ref} className={cx(control.control, styles.select, styles[size], className)} {...props}>
        {placeholder !== undefined && (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.chevron} size={16} />
    </span>
  );
});
