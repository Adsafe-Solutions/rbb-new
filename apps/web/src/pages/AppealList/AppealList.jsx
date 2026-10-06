import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import AppealGrid from "../../components/AppealGrid/AppealGrid.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { APPEALS_PAGES, DONATION, appealKindByPath, appealsOf } from "../../content/index.js";

/* One kind of appeal — /appeals/emergency or /appeals/campaigns — as a
   directory, found by the URL (content/appeals.js):

         paper   PageHeader   the kind's name and line, its icon poster
         white   AppealGrid   every appeal of the kind, or the empty sheet
         ink     TrustPanel   → /about#transparency
         accent  ClosingCta   the site-wide close */
export default function AppealList() {
  const { pathname } = useLocation();
  const kind = appealKindByPath(pathname);
  const { trust, closingCta } = DONATION;

  return (
    <>
      <PageHeader
        title={kind.label}
        parent={{ label: APPEALS_PAGES.hub.heading, to: "/appeals" }}
        kicker={kind.kicker}
        aside={<IconPanel icons={[kind.icon]} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{kind.body}</p>
      </PageHeader>

      <AppealGrid
        id="appeals"
        kicker={kind.kicker}
        heading={kind.label}
        appeals={appealsOf(kind.id)}
        empty={kind.empty}
        showKind={false}
      />

      <TrustPanel {...trust} links={DONATION.trustLinks} linkMeta={DONATION.trustLinkMeta} />

      <ClosingCta tone="accent" {...closingCta} />
    </>
  );
}
