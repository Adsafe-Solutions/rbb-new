import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { isWithin } from "../../lib/paths.js";
import { pauseScroll, resumeScroll } from "../../animations/lenis.js";
import Button from "../Button/Button.jsx";
import Picture from "../Picture/Picture.jsx";
import { withHighlight } from "../HighlightText/HighlightText.jsx";
import { MenuIcon } from "../Header/icons.jsx";
import { cardFocal } from "../../lib/focal.js";

/* The on-screen popup (content/announcements.js `popup`): a photograph,
   a kicker, a headline with one highlighted word, a line, the one call to
   action and "Maybe later". ON / OFF through config/sections.js.

   When it opens — never at load, and never in anyone's way:
     · `delayMs` after the visitor arrives (after hydration)
     · not on `excludePaths` (the Contact page, the policies)
     · not while another dialog is open — the Donate popup wins, and the
       timer waits for it to close
     · once per visit (`frequency: "session"`) or once per visitor
       ("once"), remembered against the popup's `id` — change the id and
       a new popup shows to everyone again

   A native <dialog> opened with showModal(), like DonateDialog: focus
   trap, Escape, the inert page behind it and the top layer come from the
   browser. Smooth scrolling pauses while it is open. Browser storage is
   only a convenience: if it throws (private mode, blocked storage) the
   popup still opens at most once per page view. */
const storageFor = (frequency) => {
  try {
    return frequency === "once" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export default function SitePopup({ popup }) {
  const ref = useRef(null);
  const headingId = useId();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  const key = `rbb-popup-closed:${popup.id}`;

  const excluded = (popup.excludePaths ?? []).some((path) => isWithin(pathname, path));

  /* Arm the timer. Re-armed on navigation until it has been shown once,
     so arriving on an excluded page and moving on still gets it later. */
  useEffect(() => {
    if (shown.current || excluded) return undefined;
    let closed = false;
    try {
      closed = storageFor(popup.frequency)?.getItem(key) === "1";
    } catch {
      closed = false;
    }
    if (closed) return undefined;

    let timer;
    const attempt = () => {
      /* Another dialog (the Donate popup) is open: try again shortly. */
      if (document.querySelector("dialog[open]")) {
        timer = setTimeout(attempt, 2000);
        return;
      }
      shown.current = true;
      setOpen(true);
    };
    timer = setTimeout(attempt, popup.delayMs ?? 6000);
    return () => clearTimeout(timer);
  }, [excluded, key, popup.delayMs, popup.frequency]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!open) {
      if (dialog.open) dialog.close();
      return undefined;
    }
    dialog.showModal();
    pauseScroll();
    return resumeScroll;
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      storageFor(popup.frequency)?.setItem(key, "1");
    } catch {
      /* Storage unavailable: it stays closed for this page view anyway. */
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onClose={() => open && close()}
      onClick={(e) => e.target === e.currentTarget && close()}
      data-lenis-prevent=""
      data-tone="card"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),44rem)] overflow-y-auto overscroll-contain rounded-2xl border-rim bg-paper-white p-0 text-fg shadow-[8px_8px_0_var(--color-bumble-honey)] backdrop:bg-bumble-ink/50"
    >
      {open && (
        <div className={cx("relative grid", popup.image && "sm:grid-cols-[5fr_6fr]")}>
          {popup.releaseMarker && <span hidden data-release-marker={popup.releaseMarker} />}
          {popup.image && (
            <div className="relative aspect-[16/9] border-b-2 border-[var(--tone-rim)] sm:aspect-auto sm:border-b-0 sm:border-r-2">
              <Picture
                src={popup.image.src}
                alt={popup.image.alt}
                focal={cardFocal(popup.image)}
                sizes="(min-width: 640px) 20rem, 92vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <button
              type="button"
              aria-label={popup.close}
              onClick={close}
              className="absolute right-3 top-3 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-paper-white text-trust-blue transition-colors hover:bg-mist"
            >
              <MenuIcon open />
            </button>

            {popup.kicker && <p className="type-meta pr-10 text-quiet">{popup.kicker}</p>}
            {/* A card, so a card heading: sentence case, card weight —
                larger than a card's (`!`: one property, two utilities). */}
            <h2 id={headingId} className="type-card mt-3 pr-6 text-[clamp(1.6rem,2.8vw,2.1rem)]!">
              {withHighlight(popup.heading, popup.highlight)}
            </h2>
            {popup.body && <p className="mt-4 text-copy">{popup.body}</p>}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              {popup.cta && (
                <Button to={popup.cta.to} onClick={close}>
                  {popup.cta.label}
                </Button>
              )}
              <Button variant="link" onClick={close}>
                {popup.dismiss}
              </Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
