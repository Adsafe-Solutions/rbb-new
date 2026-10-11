import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
} from "react";
import { placeFloating, type Align } from "../../floating";
import { cx } from "../../utils";
import styles from "./Menu.module.css";

/* A dropdown menu of actions (WAI-ARIA menu button pattern):
   - the trigger opens it on click, Enter, Space or ArrowDown (first item)
     and ArrowUp (last item);
   - inside, ArrowUp/ArrowDown move (wrapping), Home/End jump, a letter
     jumps to the next item starting with it;
   - Escape closes and returns focus to the trigger; Tab closes and lets
     focus move on; a click outside closes.
   It is for ACTIONS. Navigation between pages uses links. */

interface MenuState {
  close: (returnFocus?: boolean) => void;
}
const MenuContext = createContext<MenuState | null>(null);

export interface MenuTriggerProps {
  ref: RefCallback<HTMLButtonElement>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface MenuProps {
  /** Renders the trigger; spread the props onto a Button or IconButton. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  align?: Align;
  /** Overrides the trigger's text as the menu's name. */
  label?: string;
  minWidth?: number;
}

const itemsOf = (menu: HTMLElement | null) => Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

export function Menu({ trigger, children, align = "start", label, minWidth = 200 }: MenuProps) {
  const base = useId();
  const triggerId = `${base}-trigger`;
  const menuId = `${base}-menu`;
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"first" | "last">("first");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerEl = useRef<HTMLButtonElement | null>(null);
  const menuEl = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerEl.current?.focus();
  }, []);

  const openWith = (target: "first" | "last") => {
    setFocusTarget(target);
    setOpen(true);
  };

  // Position, then move focus into the menu.
  useLayoutEffect(() => {
    if (!open || !triggerEl.current || !menuEl.current) return setPosition(null);
    const place = () => {
      if (!triggerEl.current || !menuEl.current) return;
      const rect = menuEl.current.getBoundingClientRect();
      setPosition(placeFloating(triggerEl.current.getBoundingClientRect(), rect, "bottom", align));
    };
    place();
    const items = itemsOf(menuEl.current);
    (focusTarget === "first" ? items[0] : items[items.length - 1])?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, focusTarget]);

  // A pointer press outside the trigger and the menu closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuEl.current?.contains(target) || triggerEl.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openWith(event.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsOf(menuEl.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focus(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focus(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focus(0);
        break;
      case "End":
        event.preventDefault();
        focus(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const letter = event.key.toLowerCase();
          const order = [...items.slice(index + 1), ...items.slice(0, index + 1)];
          order.find((item) => item.textContent?.trim().toLowerCase().startsWith(letter))?.focus();
        }
    }
  };

  return (
    <MenuContext.Provider value={{ close }}>
      {trigger({
        ref: (node) => {
          triggerEl.current = node;
        },
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => (open ? close(false) : openWith("first")),
        onKeyDown: onTriggerKeyDown,
      })}
      {open && (
        <div
          ref={menuEl}
          id={menuId}
          role="menu"
          aria-labelledby={label ? undefined : triggerId}
          aria-label={label}
          tabIndex={-1}
          className={styles.menu}
          // Off-screen (not hidden — hidden elements cannot take focus) for
          // the one frame before it is measured and placed.
          style={{ minWidth, top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          onKeyDown={onMenuKeyDown}
        >
          {children}
        </div>
      )}
    </MenuContext.Provider>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  /** A destructive action (delete, remove), drawn in the danger colour. */
  destructive?: boolean;
  disabled?: boolean;
  /** Extra text on the right, e.g. a count. */
  hint?: ReactNode;
}

export function MenuItem({ children, onSelect, icon, destructive, disabled, hint }: MenuItemProps) {
  const menu = useContext(MenuContext);
  const activate = () => {
    if (disabled) return;
    menu?.close(true);
    onSelect?.();
  };
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      className={cx(styles.item, destructive && styles.destructive)}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}

/** A non-interactive heading or block at the top of a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className={styles.label}>
      {children}
    </div>
  );
}
