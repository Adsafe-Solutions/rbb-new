import DonationExperience from "../../components/DonationExperience/DonationExperience.jsx";
import AppealGrid from "../../components/AppealGrid/AppealGrid.jsx";
import AppealLists from "../../components/AppealLists/AppealLists.jsx";
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
   own bands in the middle: the emergency appeals and campaigns to choose
   from, each a donation page of its own.

         paper   hero + context + the donation form
         white   Why your support matters
         paper   How your support helps
         white   Emergency Response   ┐ this page's own bands
         paper   Campaigns            ┘
         white   Ways to give — only once RBB approves a method
         ink     Transparency
         white   FAQ
         accent  Donate → back to the form */
export default function Appeals() {
  /* The CMS's published page names its own eyebrow; the source page is
     headed "Appeals". */
  const general = generalDonation();
  const experience = general.source === "cms" ? general : { ...general, eyebrow: APPEALS_PAGES.hub.heading };
  const methods = approvedGivingMethods();

  return (
    <DonationExperience experience={experience}>
      {/* A CMS page's own appeal lists (Milestone 7), else the page's own bands. */}
      {experience.lists ? <AppealLists lists={experience.lists} /> : APPEAL_KINDS.map((kind, i) => (
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
        <GivingMethods tone="white" {...DONATION.ways} methods={methods} live={donationState() === "approved-live"} />
      )}
    </DonationExperience>
  );
}
