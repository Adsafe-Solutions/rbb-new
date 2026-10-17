import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx.js";
import { pauseScroll, resumeScroll } from "../../animations/lenis.js";
import { MenuIcon } from "../Header/icons.jsx";

/* The site's one popup frame — the Donate popup, the on-screen popup and
   an event's registration form all open in it, so they look and behave
   alike.

   A native <dialog> opened with showModal(): the browser supplies the
   focus trap, Escape, the inert page behind it and the top layer, so it
   paints over the fixed header without a z-index war. A press on the
   backdrop lands on the <dialog> itself (everything visible is inside the
   panel) and closes it.

   ⚠ The PANEL never scrolls; the area inside it does. A scrolling dialog
   draws its scrollbar inside its own box, square, over the rounded right
   corners — the registration form and the Donate form on a phone are both
   taller than the screen. Clipped by the panel (`overflow-hidden` with the
   radius), the inner scrollbar keeps the corners round.

   ⚠ The close button sits OUTSIDE that scrolling area, inset from the
   corner: it stays put while a long form scrolls, and its focus ring
   (it takes focus when the popup opens) stays inside the rounded edge.

   ⚠ Lenis is paused while it is open, like the mobile menu: smooth
   scrolling listens to the wheel and would go on moving the page behind.
   `data-lenis-prevent` lets the popup scroll itself.

   `children` mount only while it is open, so a form inside starts empty
   each time and a closed popup costs nothing. */
const WIDTHS = {
  md: "w-[min(calc(100%-2rem),36rem)]",
  lg: "w-[min(calc(100%-2rem),44rem)]",
};

export default function Modal({ open, onClose, labelledBy, closeLabel = "Close", size = "md", className = "", children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!open) {
      if (dialog.open) dialog.close();
      return undefined;
    }
    if (!dialog.open) dialog.showModal();
    pauseScroll();
    return resumeScroll;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      /* Escape fires `cancel`, then `close`; closing it from state fires
         `close` too — only an open popup reports it. */
      onClose={() => open && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-tone="card"
      className={cx(
        "m-auto max-h-[calc(100dvh-2rem)] overflow-hidden overscroll-contain rounded-2xl border-rim bg-paper-white p-0 text-fg shadow-[8px_8px_0_var(--color-bumble-honey)] backdrop:bg-bumble-ink/50 open:flex open:flex-col",
        WIDTHS[size] ?? WIDTHS.md,
        className
      )}
    >
      {open && (
        <>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-paper-white text-trust-blue transition-colors hover:bg-mist"
          >
            <MenuIcon open />
          </button>
          <div data-lenis-prevent="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </>
      )}
    </dialog>
  );
}
