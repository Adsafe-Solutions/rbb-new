import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Minus } from "../../icons";
import { cx, mergeRefs } from "../../utils";
import choice from "./choice.module.css";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** The visible label. Omit only when an `aria-label` names the box
   * (e.g. selecting a table row). */
  label?: ReactNode;
  description?: ReactNode;
  /** "Some but not all" — e.g. a select-all box over a partial selection. */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, id, disabled, className, ...rest },
  ref
) {
  const generated = useId();
  const inputId = id ?? `checkbox${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const inner = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cx(choice.choice, disabled && choice.disabled, className)}>
      <span className={choice.control}>
        <input
          ref={mergeRefs(ref, inner)}
          id={inputId}
          type="checkbox"
          className={choice.input}
          disabled={disabled}
          aria-describedby={descriptionId}
          {...rest}
        />
        <span className={styles.box} aria-hidden="true">
          <Check className={styles.check} size={12} strokeWidth={3} />
          <Minus className={styles.minus} size={12} strokeWidth={3} />
        </span>
      </span>
      {(label || description) && (
        <span className={choice.text}>
          {label && (
            <label htmlFor={inputId} className={choice.label}>
              {label}
            </label>
          )}
          {description && (
            <span id={descriptionId} className={choice.description}>
              {description}
            </span>
          )}
        </span>
      )}
    </div>
  );
});
