import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "scheduled";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  /** A leading icon. A tone's colour never carries meaning alone, so a
   * badge's words must still say what it means. */
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = "neutral", size = "md", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}
