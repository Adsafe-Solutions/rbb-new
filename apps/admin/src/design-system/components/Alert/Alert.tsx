import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type IconComponent } from "../../icons";
import { cx } from "../../utils";
import styles from "./Alert.module.css";

export type AlertTone = "info" | "success" | "warning" | "danger";

const ICONS: Record<AlertTone, IconComponent> = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
}

/** An inline message inside the page. Give it `role="alert"` when it
 * appears in response to an action (a failed sign-in); a message present
 * from the start needs no role. For transient feedback, use a toast. */
export function Alert({ tone = "info", title, children, className, ...rest }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div className={cx(styles.alert, styles[tone], className)} {...rest}>
      <Icon className={styles.icon} size={16} />
      <div className={styles.text}>
        {title && <p className={styles.title}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
