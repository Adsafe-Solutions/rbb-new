import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "../Button/Button.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import DonationForm from "../DonationForm/DonationForm.jsx";
import { MenuIcon } from "../Header/icons.jsx";
import { pauseScroll, resumeScroll } from "../../animations/lenis.js";
import { DONATION, donationActionBlock, donationState } from "../../content/index.js";

/* The donation popup — what the header's Donate button opens, from every
   page. The same donation action as the appeal pages (DonationAction),
   in the same state (content/donation.js), drawn as a dialog: the
   statement, then THE donation form (components/DonationForm, shared by
   every donation page) — or, once giving is live through an external
   provider page, that link — and a way on to the appeals.

   A native <dialog> opened with showModal(): the browser supplies the
   focus trap, Escape, the inert page behind it and the top layer, so it
   paints over the fixed header without a z-index war.

   The form mounts only while the dialog is open, so it starts empty each
   time and a closed dialog costs nothing.

   ⚠ Lenis is paused while it is open, like the mobile menu: smooth
   scrolling listens to the wheel, and would go on moving the page behind
   the dialog. `data-lenis-prevent` lets the dialog scroll itself.

   Open it with `useDonate()`; the header's button is a link to the
   appeals until hydration, so it works without JavaScript too. */

const DonateContext = createContext({ openDonate: () => {} });

export const useDonate = () => useContext(DonateContext);

export function DonateProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openDonate = useCallback(() => setOpen(true), []);

  return (
    <DonateContext.Provider value={{ openDonate }}>
      {children}
      <DonateDialog open={open} onClose={() => setOpen(false)} />
    </DonateContext.Provider>
  );
}

function DonateDialog({ open, onClose }) {
  const ref = useRef(null);
  const headingId = useId();
  const { pathname } = useLocation();

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

  /* Following a link inside it navigates; the page underneath changes,
     so the dialog goes. */
  useEffect(() => onClose(), [pathname]);

  /* Live with an external provider page: that page's statement and its
     link. Otherwise the popup's own statement over THE donation form —
     the same component every donation page draws. */
  const live = donationState() === "approved-live";
  const block = live ? donationActionBlock("approved-live") : DONATION.dialog;
  const body = block.body ?? [];

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      /* Escape fires `cancel`, then `close`; either way, state follows. */
      onClose={onClose}
      /* A press on the backdrop lands on the <dialog> itself — everything
         visible is inside the panel. */
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-lenis-prevent=""
      data-tone="card"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),36rem)] overflow-y-auto overscroll-contain rounded-2xl border-rim bg-paper-white p-0 text-fg shadow-[8px_8px_0_var(--color-bumble-honey)] backdrop:bg-bumble-ink/50"
    >
      {open && (
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2.5 text-trust-blue transition-colors hover:bg-mist"
          >
            <MenuIcon open />
          </button>

          <MarkStamp className="h-12 w-12 -rotate-6" />
          <p className="type-meta mt-6 text-quiet">{DONATION.dialog.kicker}</p>
          <h2 id={headingId} className="type-title mt-3 max-w-[18ch]">
            {block.heading}
          </h2>
          {body.map((text) => (
            <p key={text} className="mt-4 max-w-[48ch] text-copy">
              {text}
            </p>
          ))}

          {live && (
            <Button href={block.url} rel="noopener noreferrer" className="mt-6 whitespace-normal!">
              {block.label}
            </Button>
          )}

          {!live && (
            <div className="mt-8">
              <DonationForm
                config={DONATION.form.config}
                copy={DONATION.form.copy}
                donation={{ type: "general", designation: "where-needed-most", source: "header-popup" }}
                formId="donation-popup"
              />
            </div>
          )}

          <p className="mt-8 border-t-2 border-hair pt-6 text-copy">
            {DONATION.popup.appealsIntro}{" "}
            <Link to={DONATION.popup.appeals.to} className="font-bold text-fg underline decoration-2 underline-offset-4">
              {DONATION.popup.appeals.label}
            </Link>
          </p>
        </div>
      )}
    </dialog>
  );
}

export default DonateProvider;
