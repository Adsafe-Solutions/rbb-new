import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils";
import styles from "./Page.module.css";

/** The width and gutters of a page's content inside the shell. */
export function PageContainer({ width = "default", className, ...rest }: HTMLAttributes<HTMLDivElement> & { width?: "default" | "narrow" | "full" }) {
  return <div className={cx(styles.container, styles[width], className)} {...rest} />;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** The page's main actions, right-aligned (stacked on narrow screens). */
  actions?: ReactNode;
  /** Small text above the title, e.g. a section or status. */
  eyebrow?: ReactNode;
  className?: string;
}

/** The page's one <h1>, its summary and its actions. */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.text}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

/** A titled group of content within a page. */
export function PageSection({ title, description, actions, children, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx(styles.section, className)}>
      <div className={styles.sectionHeader}>
        <div className={styles.text}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
