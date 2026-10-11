import { cx } from "../../utils";
import styles from "./Spinner.module.css";

export type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  /** Announced to screen readers. Pass `null` when the spinner sits inside
   * something that already says it is busy (a loading button). */
  label?: string | null;
  className?: string;
}

/** An indeterminate progress indicator. */
export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  const ring = (
    <svg className={cx(styles.spinner, styles[size], className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className={styles.track} cx="12" cy="12" r="9" strokeWidth="2.5" />
      <path className={styles.arc} d="M21 12a9 9 0 0 0-9-9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (label === null) return ring;
  return (
    <span role="status" className={styles.wrap}>
      {ring}
      <span className="ds-visually-hidden">{label}</span>
    </span>
  );
}

/** A placeholder block while content loads. Decorative: the container
 * that is loading carries `aria-busy`. */
export function Skeleton({ width, height = 12, className }: { width?: number | string; height?: number | string; className?: string }) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height }} aria-hidden="true" />;
}
