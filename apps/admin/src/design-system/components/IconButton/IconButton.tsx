import { forwardRef, type ReactNode } from "react";
import { cx } from "../../utils";
import { Button, type ButtonProps } from "../Button/Button";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "leadingIcon" | "trailingIcon" | "fullWidth"> {
  /** The accessible name. Required: an icon alone is not a name. */
  label: string;
  icon: ReactNode;
}

/** A square button with only an icon. Pair with a Tooltip so sighted
 * mouse users get the name too. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", className, ...rest },
  ref
) {
  return <Button ref={ref} variant={variant} size={size} aria-label={label} leadingIcon={icon} className={cx(styles.icon, styles[size], className)} {...rest} />;
});
