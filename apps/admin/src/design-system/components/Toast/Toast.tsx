import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type IconComponent } from "../../icons";
import { cx } from "../../utils";
import styles from "./Toast.module.css";

/* Short-lived feedback about something the person just did ("Saved").
   Anything they must act on belongs in the page (Alert) or a Dialog.

   Announcements go through two live regions that exist from the first
   render — a region inserted together with its text is often not read.
   Danger toasts are assertive; the rest polite. Toasts close themselves
   after `duration`, but not while the pointer or focus is on them, and
   each has a dismiss button. */

export type ToastTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds; 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

const ICONS: Record<ToastTone, IconComponent | null> = { neutral: null, info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const MAX_VISIBLE = 4;

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [announcement, setAnnouncement] = useState({ polite: "", assertive: "" });
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const tone = options.tone ?? "neutral";
    const record: ToastRecord = { id, title: options.title, description: options.description, tone, duration: options.duration ?? (tone === "danger" ? 8000 : 5000) };
    setToasts((list) => [...list, record].slice(-MAX_VISIBLE));
    const text = [options.title, options.description].filter(Boolean).join(". ");
    setAnnouncement(tone === "danger" ? { polite: "", assertive: text } : { polite: text, assertive: "" });
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ds-visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement.polite}
      </div>
      <div className="ds-visually-hidden" aria-live="assertive" aria-atomic="true">
        {announcement.assertive}
      </div>
      <section className={styles.viewport} aria-label="Notifications" hidden={toasts.length === 0}>
        <ol className={styles.list}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!toast.duration || paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, paused, onDismiss]);

  const Icon = ICONS[toast.tone];
  return (
    <li
      className={cx(styles.toast, styles[toast.tone])}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {Icon && <Icon className={styles.icon} size={18} />}
      <div className={styles.text}>
        <p className={styles.title}>{toast.title}</p>
        {toast.description && <p className={styles.description}>{toast.description}</p>}
      </div>
      <button type="button" className={styles.dismiss} aria-label={`Dismiss notification: ${toast.title}`} onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
    </li>
  );
}
