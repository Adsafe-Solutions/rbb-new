import { useLocation } from "react-router-dom";
import DonationExperience from "../../components/DonationExperience/DonationExperience.jsx";
import AppealGrid from "../../components/AppealGrid/AppealGrid.jsx";
import { APPEALS, APPEALS_PAGES, appealByPath, appealDonation, appealKind } from "../../content/index.js";

/* One page template for every appeal — each Emergency Response appeal and
   each Campaign (content/appeals.js), found by the URL. A new appeal is a
   record in that file, never a new page here.

   It is a donation page, so it is the shared donation page
   (components/DonationExperience) with the appeal as its context —
   `appealDonation(appeal)` turns the record into "Support <appeal>", its
   story, what support funds and the gift's internal context
   ({ appeal: id } or { campaign: id }). The form is the site's one
   DonationForm. This page adds only its own band: the other appeals of
   the same kind (or all others, when it is the only one). */
export default function Appeal() {
  const { pathname } = useLocation();
  const appeal = appealByPath(pathname);
  const kind = appealKind(appeal.kind);
  const t = APPEALS_PAGES.appeal;

  const sameKind = APPEALS.filter((a) => a.kind === appeal.kind && a.id !== appeal.id);
  const others = sameKind.length > 0 ? sameKind : APPEALS.filter((a) => a.id !== appeal.id);

  return (
    <DonationExperience experience={appealDonation(appeal)}>
      {others.length > 0 && (
        <AppealGrid
          {...t.more}
          tone="white"
          appeals={others}
          cta={{ label: `${APPEALS_PAGES.hub.listCta} ${kind.label}`, to: kind.to }}
        />
      )}
    </DonationExperience>
  );
}
