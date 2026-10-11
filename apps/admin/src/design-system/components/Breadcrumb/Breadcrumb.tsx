import type { MouseEvent, ReactNode } from "react";
import { ChevronRight } from "../../icons";
import { cx } from "../../utils";
import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  label: ReactNode;
  /** Omit for the current page (always the last item). */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Client-side navigation for a plain click; modified clicks
   * (new tab, new window) are left to the browser. */
  onNavigate?: (href: string) => void;
  className?: string;
}

export function Breadcrumb({ items, onNavigate, className }: BreadcrumbProps) {
  const follow = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
  return (
    <nav aria-label="Breadcrumb" className={cx(styles.breadcrumb, className)}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={index} className={styles.item}>
              {index > 0 && <ChevronRight className={styles.separator} size={14} />}
              {current || !item.href ? (
                <span className={cx(styles.text, current && styles.current)} aria-current={current ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className={styles.link} onClick={follow(item.href)}>
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
