import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type Ref } from "react";
import { placeFloating, type Side } from "../../floating";
import { mergeRefs } from "../../utils";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  content: ReactNode;
  /** One focusable element: a button or link. */
  children: ReactElement;
  side?: Side;
  /** Milliseconds before a hover opens it. Keyboard focus opens it at once. */
  delay?: number;
  /** For an icon-only control whose `aria-label` already says the same
   * thing: the tooltip is then shown but not announced twice. */
  labelOnly?: boolean;
  /** Turn the tooltip off without changing the tree (e.g. expanded nav). */
  disabled?: boolean;
}

type ChildProps = {
  "aria-describedby"?: string;
  onPointerEnter?: (e: unknown) => void;
  onPointerLeave?: (e: unknown) => void;
  onFocus?: (e: unknown) => void;
  onBlur?: (e: unknown) => void;
};

/* A short, non-interactive description of a control, shown on hover and
   on keyboard focus, hidden by Escape (WCAG 1.4.13). The text is always in
   the DOM — hidden when closed — so `aria-describedby` resolves. */
export function Tooltip({ content, children, side = "top", delay = 350, labelOnly = false, disabled = false }: TooltipProps) {
  const id = `tooltip${useId()}`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (immediately: boolean) => {
      window.clearTimeout(timer.current);
      if (disabled) return;
      if (immediately) setOpen(true);
      else timer.current = window.setTimeout(() => setOpen(true), delay);
    },
    [delay, disabled]
  );
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !bubble.current) return setPosition(null);
    const rect = bubble.current.getBoundingClientRect();
    setPosition(placeFloating(anchor.current.getBoundingClientRect(), rect, side));
  }, [open, side, content]);

  if (!isValidElement<ChildProps>(children)) return children;
  const own = children.props;
  const trigger = cloneElement(children, {
    // React 18 keeps a child's own ref on the element; keep it working.
    ref: mergeRefs((children as { ref?: Ref<HTMLElement> }).ref, anchor),
    "aria-describedby": labelOnly ? own["aria-describedby"] : [own["aria-describedby"], id].filter(Boolean).join(" "),
    onPointerEnter: (e: unknown) => {
      own.onPointerEnter?.(e);
      show(false);
    },
    onPointerLeave: (e: unknown) => {
      own.onPointerLeave?.(e);
      hide();
    },
    onFocus: (e: unknown) => {
      own.onFocus?.(e);
      // Only keyboard focus: a click focuses too, and should not pop a tooltip.
      if (anchor.current?.matches(":focus-visible")) show(true);
    },
    onBlur: (e: unknown) => {
      own.onBlur?.(e);
      hide();
    },
  } as Partial<ChildProps>);

  return (
    <>
      {trigger}
      <div
        ref={bubble}
        id={id}
        role="tooltip"
        className={styles.tooltip}
        data-open={(open && !disabled) || undefined}
        aria-hidden={labelOnly || undefined}
        style={position ? { top: position.top, left: position.left } : undefined}
      >
        {content}
      </div>
    </>
  );
}
