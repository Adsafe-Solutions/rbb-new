import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "../Button/Button.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import DonationForm from "../DonationForm/DonationForm.jsx";
import Modal from "../Modal/Modal.jsx";
import { DONATION, donationActionBlock, donationState } from "../../content/index.js";

/* The donation popup — what the header's Donate button opens, from every
   page. The same donation action as the appeal pages,
   in the same state (content/donation.js), drawn as a dialog: the
   statement, then THE donation form (components/DonationForm, shared by
   every donation page) — or, once giving is live through an external
   provider page, that link — and a way on to the appeals.

   Drawn in the site's popup frame (components/Modal: the native dialog,
   its rounded panel, the close button, smooth scrolling paused). The form
   mounts only while it is open, so it starts empty each time.

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
  const headingId = useId();
  const { pathname } = useLocation();

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
    <Modal open={open} onClose={onClose} labelledBy={headingId}>
      <div className="p-6 sm:p-8">
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
    </Modal>
  );
}

export default DonateProvider;
