import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { cx } from "../../utils";
import { Spinner } from "../Spinner/Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks, but keeps focus on the button
   * (a `disabled` button would drop focus to the page). */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

/* `aria-disabled` is the "unavailable but still focusable" state: a
   placeholder control can still be reached and explain itself in a
   tooltip, which a `disabled` one cannot. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, leadingIcon, trailingIcon, fullWidth, className, children, onClick, type = "button", ...rest },
  ref
) {
  const blocked = loading || rest["aria-disabled"] === true || rest["aria-disabled"] === "true";
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.full, className)}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <Spinner size="sm" label={null} /> : leadingIcon}
      {children !== undefined && <span className={styles.label}>{children}</span>}
      {!loading && trailingIcon}
    </button>
  );
});
