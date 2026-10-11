import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils";
import choice from "../Checkbox/choice.module.css";
import styles from "./Switch.module.css";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> {
  label: ReactNode;
  description?: ReactNode;
}

/* An on/off setting that takes effect immediately. A checkbox with
   `role="switch"`: Space toggles it, and screen readers say "on"/"off".
   For a choice confirmed by a Save button, use Checkbox. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ label, description, id, disabled, className, ...rest }, ref) {
  const generated = useId();
  const inputId = id ?? `switch${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  return (
    <div className={cx(choice.choice, disabled && choice.disabled, className)}>
      <span className={choice.control}>
        <input ref={ref} id={inputId} type="checkbox" role="switch" className={choice.input} disabled={disabled} aria-describedby={descriptionId} {...rest} />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </span>
      <span className={choice.text}>
        <label htmlFor={inputId} className={choice.label}>
          {label}
        </label>
        {description && (
          <span id={descriptionId} className={choice.description}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
});
