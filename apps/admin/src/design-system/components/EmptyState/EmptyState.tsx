import type { ReactNode } from "react";
import type { IconComponent } from "../../icons";
import { cx } from "../../utils";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  icon?: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links that move the person on. */
  actions?: ReactNode;
  /** A dashed frame, for an empty region inside a page. */
  bordered?: boolean;
  size?: "sm" | "md";
  /** The heading level, to fit the page outline. */
  as?: "h2" | "h3" | "h4";
  className?: string;
}

/** What a region shows when it has nothing in it yet: say what will be
 * here and, when there is one, the next step. */
export function EmptyState({ icon: Icon, title, description, actions, bordered, size = "md", as: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, styles[size], bordered && styles.bordered, className)}>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={20} />
        </span>
      )}
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
