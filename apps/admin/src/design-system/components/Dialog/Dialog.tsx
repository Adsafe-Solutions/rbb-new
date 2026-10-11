import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { X } from "../../icons";
import { cx } from "../../utils";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Dialog.module.css";

/* Modal layers on the native <dialog> element. showModal() gives, from
   the browser: the page behind made inert (focus cannot leave), Escape to
   cancel, the top layer (nothing can sit above it), and ::backdrop.
   What this adds: controlled open state, focus returned to whatever
   opened it, a labelled title and description, and backdrop-click to
   close. */

function useModal(open: boolean, onClose: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  // Return focus to the opener once closed (and if it still exists).
  useEffect(() => {
    if (open) return;
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected) target.focus();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Escape fires `cancel`; keep the dialog controlled by the parent.
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  // A click whose target is the <dialog> itself landed on the backdrop
  // (the content fills the dialog box, so it never targets it).
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  };
  return { ref, onBackdropClick };
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, least destructive first (it gets focus first). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Element to focus on open; defaults to the first focusable one. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Off for a dialog whose work would be lost by a stray click. */
  dismissOnBackdrop?: boolean;
}

export function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocus, dismissOnBackdrop = true }: DialogProps) {
  const base = useId();
  const { ref, onBackdropClick } = useModal(open, onClose, initialFocus);
  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      aria-labelledby={`${base}-title`}
      aria-describedby={description ? `${base}-description` : undefined}
      onClick={dismissOnBackdrop ? onBackdropClick : undefined}
      data-ds-modal=""
    >
      {open && (
        <div className={styles.content}>
          <header className={styles.header}>
            <h2 id={`${base}-title`} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={`${base}-description`} className={styles.description}>
                {description}
              </p>
            )}
          </header>
          {children && <div className={styles.body}>{children}</div>}
          {footer && <footer className={styles.footer}>{footer}</footer>}
          {/* Last in the DOM so it is not what receives focus first. */}
          <IconButton className={styles.close} label="Close" icon={<X />} size="sm" onClick={onClose} />
        </div>
      )}
    </dialog>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Names the drawer for screen readers. */
  label: string;
  side?: "left" | "right";
  /* "sm" for navigation (300px); "lg" for a detail panel (480px). Both
     are capped by the screen width. */
  size?: "sm" | "lg";
  id?: string;
  children: ReactNode;
  className?: string;
}

/** A modal panel from the edge of the screen — the mobile navigation. */
export function Drawer({ open, onClose, label, side = "left", size = "sm", id, children, className }: DrawerProps) {
  const { ref, onBackdropClick } = useModal(open, onClose);
  return (
    <dialog ref={ref} id={id} className={cx(styles.drawer, styles[side], size === "lg" && styles.drawerLg, className)} aria-label={label} onClick={onBackdropClick} data-ds-modal="">
      {open && <div className={styles.drawerContent}>{children}</div>}
    </dialog>
  );
}
