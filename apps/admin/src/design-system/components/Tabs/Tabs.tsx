import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../../utils";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Names the tab list for screen readers. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/* WAI-ARIA tabs with automatic activation: one tab stop for the whole
   list (roving tabindex); Left/Right move and select, Home/End jump to the
   ends, disabled tabs are skipped. Tab moves on into the panel. */
export function Tabs({ items, label, value, defaultValue, onValueChange, className }: TabsProps) {
  const base = useId();
  const firstEnabled = items.find((item) => !item.disabled)?.id;
  const [inner, setInner] = useState(defaultValue ?? firstEnabled);
  const active = value ?? inner;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
    const position = enabled.indexOf(index);
    let next: number | undefined;
    if (event.key === "ArrowRight") next = enabled[(position + 1) % enabled.length];
    else if (event.key === "ArrowLeft") next = enabled[(position - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    tabs.current[next]?.focus();
    select(items[next].id);
  };

  return (
    <div className={cx(styles.tabs, className)}>
      <div role="tablist" aria-label={label} className={styles.list}>
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-controls={`${base}-panel-${item.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className={styles.tab}
              onClick={() => select(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className={styles.panel}
        >
          {item.id === active && item.content}
        </div>
      ))}
    </div>
  );
}
