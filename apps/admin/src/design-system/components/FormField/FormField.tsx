import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { CircleAlert } from "../../icons";
import { cx } from "../../utils";
import { Label } from "../Label/Label";
import styles from "./FormField.module.css";

/* FormField owns the wiring between a label, its control and the text
   around it. Input, Textarea and Select read this context, so

     <FormField label="Title" helper="Shown in search results" error={error}>
       <Input value={…} onChange={…} />
     </FormField>

   gives the control its id, `aria-describedby` (helper and error),
   `aria-invalid`, `required` and `disabled` without repeating them. */
export interface FieldState {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldState | null>(null);

/** The surrounding FormField's wiring, or null outside one. */
export const useField = () => useContext(FieldContext);

export interface FormFieldProps {
  label: ReactNode;
  children: ReactNode;
  helper?: ReactNode;
  /** An error message. Its presence marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Overrides the generated id, e.g. for a stable test hook. */
  id?: string;
  className?: string;
}

export function FormField({ label, children, helper, error, required = false, disabled = false, id, className }: FormFieldProps) {
  const generated = useId();
  const controlId = id ?? `field${generated}`;
  const helperId = helper ? `${controlId}-helper` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const state: FieldState = { id: controlId, describedBy, invalid: Boolean(error), required, disabled };

  return (
    <div className={cx(styles.field, className)} data-invalid={state.invalid || undefined}>
      <Label htmlFor={controlId} required={required} disabled={disabled}>
        {label}
      </Label>
      <FieldContext.Provider value={state}>{children}</FieldContext.Provider>
      {helper && (
        <p id={helperId} className={styles.helper}>
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <CircleAlert size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Merge a FormField's wiring into a control's own props. Props the
 * control was given directly win. */
export function useFieldProps<P extends { id?: string; "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"]; required?: boolean; disabled?: boolean }>(
  props: P,
  invalidProp?: boolean
) {
  const field = useField();
  const describedBy = [field?.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  const own = props["aria-invalid"];
  const invalid = invalidProp ?? field?.invalid ?? (own === true || own === "true");
  return {
    ...props,
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    required: props.required ?? field?.required,
    disabled: props.disabled ?? field?.disabled,
  };
}
