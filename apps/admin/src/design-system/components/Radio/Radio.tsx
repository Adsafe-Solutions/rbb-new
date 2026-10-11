import { createContext, forwardRef, useContext, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils";
import choice from "../Checkbox/choice.module.css";
import styles from "./Radio.module.css";

interface GroupState {
  name: string;
  value: string | undefined;
  onChange: ((value: string) => void) | undefined;
  disabled: boolean;
}
const GroupContext = createContext<GroupState | null>(null);

export interface RadioGroupProps {
  /** The question the options answer; rendered as the fieldset legend. */
  legend: ReactNode;
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
  children: ReactNode;
  className?: string;
}

/* A fieldset + legend: the semantic grouping screen readers expect for
   radios. Arrow keys between options come from the browser, because the
   inputs share one `name`. */
export function RadioGroup({ legend, name, value, onValueChange, helper, error, required, disabled = false, orientation = "vertical", children, className }: RadioGroupProps) {
  const generated = useId();
  const groupName = name ?? `radio${generated}`;
  const helperId = helper ? `${groupName}-helper` : undefined;
  const errorId = error ? `${groupName}-error` : undefined;
  return (
    <fieldset
      className={cx(styles.group, className)}
      disabled={disabled}
      aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
    >
      <legend className={styles.legend}>
        {legend}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <GroupContext.Provider value={{ name: groupName, value, onChange: onValueChange, disabled }}>
        <div className={cx(styles.options, orientation === "horizontal" && styles.horizontal)}>{children}</div>
      </GroupContext.Provider>
      {helper && (
        <p id={helperId} className={styles.helper}>
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ value, label, description, id, disabled, className, ...rest }, ref) {
  const group = useContext(GroupContext);
  const generated = useId();
  const inputId = id ?? `radio${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const isDisabled = disabled ?? group?.disabled;
  const controlled = group?.value !== undefined ? { checked: group.value === value, onChange: () => group.onChange?.(value) } : {};
  return (
    <div className={cx(choice.choice, isDisabled && choice.disabled, className)}>
      <span className={choice.control}>
        <input
          ref={ref}
          id={inputId}
          type="radio"
          name={group?.name}
          value={value}
          className={choice.input}
          disabled={isDisabled}
          aria-describedby={descriptionId}
          {...controlled}
          {...rest}
        />
        <span className={styles.circle} aria-hidden="true" />
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
