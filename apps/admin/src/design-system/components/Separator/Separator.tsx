import { cx } from "../../utils";
import styles from "./Separator.module.css";

interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  /** Decorative by default (hidden from screen readers). Set false when
   * the line separates content a reader should know is grouped. */
  decorative?: boolean;
  className?: string;
}

export function Separator({ orientation = "horizontal", decorative = true, className }: SeparatorProps) {
  return (
    <div
      className={cx(styles.separator, styles[orientation], className)}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative || orientation === "horizontal" ? undefined : orientation}
    />
  );
}
