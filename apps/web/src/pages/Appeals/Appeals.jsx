import DonationExperience from "../../components/DonationExperience/DonationExperience.jsx";
import AppealGrid from "../../components/AppealGrid/AppealGrid.jsx";
import AppealLists, { shownLists } from "../../components/AppealLists/AppealLists.jsx";
import GivingMethods from "../../components/GivingMethods/GivingMethods.jsx";
import {
  APPEAL_KINDS,
  APPEALS_PAGES,
  DONATION,
  appealsOf,
  approvedGivingMethods,
  donationState,
  generalDonation,
} from "../../content/index.js";

/* /appeals — the general donation page (the old /donate and
   /get-involved/donate addresses forward here). The shared donation page
   (components/DonationExperience) for a general gift, with this page's
   own bands in the middle: the emergency appeals, campaigns and special
   appeals to choose from, each a donation page of its own.

         paper   hero + context + the donation form
         white   Why your support matters
         paper   How your support helps
         white   Emergency Response   ┐ this page's own bands,
         paper   Campaigns            │ alternating — only the kinds
         white   Special Appeals      ┘ with an appeal open (2026-10-17)
         paper   Ways to give — only once RBB approves a method; the
                 tone the appeal bands did not end on
         ink     Transparency
         white   FAQ
         accent  Donate → back to the form */
export default function Appeals() {
  /* The general donation page as the CMS published it (2026-10-13: there
     is no built-in one). */
  const experience = generalDonation();
  if (!experience) return null;
  const methods = approvedGivingMethods();
  /* A kind with nothing open is not shown (RBB's request, 2026-10-17). */
  const kinds = APPEAL_KINDS.filter((kind) => appealsOf(kind.id).length > 0);
  const lists = experience.lists ? shownLists(experience.lists) : null;
  /* The appeal bands alternate from white; the band after them takes the
     other tone, so no two neighbours share one, however many there are. */
  const bands = lists ? lists.length : kinds.length;
  const afterBands = bands % 2 ? "paper" : "white";

  return (
    <DonationExperience experience={experience}>
      {/* A CMS page's own appeal lists (Milestone 7), else the page's own bands. */}
      {lists ? <AppealLists lists={lists} /> : kinds.map((kind, i) => (
        <AppealGrid
          key={kind.id}
          id={kind.id}
          tone={i % 2 ? "paper" : "white"}
          kicker={kind.kicker}
          heading={kind.label}
          appeals={appealsOf(kind.id)}
          empty={kind.empty}
          cta={{ label: `${APPEALS_PAGES.hub.listCta} ${kind.label}`, to: kind.to }}
          showKind={false}
        />
      ))}
      {methods.length > 0 && (
        <GivingMethods tone={afterBands} {...DONATION.ways} methods={methods} live={donationState() === "approved-live"} />
      )}
    </DonationExperience>
  );
}
