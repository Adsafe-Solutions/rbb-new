import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils";
import styles from "./Card.module.css";

type Padding = "none" | "sm" | "md" | "lg";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** "surface" is white (in RBB's theme); "subtle" and "canvas" step back. */
  tone?: "surface" | "subtle" | "canvas";
  bordered?: boolean;
  padding?: Padding;
  radius?: "md" | "lg" | "xl";
}

/** The base box: a ground colour, an optional 1px border, padding.
 * Elevation comes from borders, not shadows — shadows are for layers
 * that float (menus, dialogs, toasts). */
export function Surface({ tone = "surface", bordered = false, padding = "md", radius = "lg", className, ...rest }: SurfaceProps) {
  return <div className={cx(styles.box, styles[`tone-${tone}`], bordered && styles.bordered, styles[`pad-${padding}`], styles[`radius-${radius}`], className)} {...rest} />;
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  /** Hover feedback for a card that is itself a link or button. */
  interactive?: boolean;
}

/** A bordered white card. Compose with CardHeader / CardBody /
 * CardFooter, or pass `padding` for a plain box. */
export function Card({ padding = "none", interactive, className, ...rest }: CardProps) {
  return <div className={cx(styles.box, styles["tone-surface"], styles.bordered, styles.card, styles[`pad-${padding}`], styles["radius-lg"], interactive && styles.interactive, className)} {...rest} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The heading level for the title; pick what fits the page outline. */
  as?: "h2" | "h3" | "h4";
  titleId?: string;
  className?: string;
}

export function CardHeader({ title, description, actions, as: Heading = "h3", titleId, className }: CardHeaderProps) {
  return (
    <div className={cx(styles.header, className)}>
      <div className={styles.headerText}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.body, className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.footer, className)} {...rest} />;
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  as?: "h2" | "h3" | "h4";
  /** Drops the body padding, for a table or list that runs edge to edge. */
  flush?: boolean;
}

/** A titled section of a page: header row, divider, body, optional
 * footer. A <section> named by its title. */
export function Panel({ title, description, actions, footer, as = "h2", flush, className, children, ...rest }: PanelProps) {
  const titleId = `panel${useId()}`;
  return (
    <section aria-labelledby={titleId} className={cx(styles.box, styles["tone-surface"], styles.bordered, styles.card, styles["radius-lg"], className)} {...rest}>
      <CardHeader title={title} description={description} actions={actions} as={as} titleId={titleId} className={styles.panelHeader} />
      <div className={flush ? undefined : styles.body}>{children}</div>
      {footer && <CardFooter>{footer}</CardFooter>}
    </section>
  );
}
