import AppealGrid from "../AppealGrid/AppealGrid.jsx";
import { APPEALS, APPEALS_PAGES, appealKind, appealsOf } from "../../content/index.js";

/* Milestone 7 — a CMS donation page's own appeal lists (the contract's
   `appealList` sections, in order), in place of the page's built-in appeal
   bands. Each lists the published appeals of its kind, or all of them;
   `exclude` leaves out the appeal whose page this is. A list with nothing
   in it is left out — a kind with no appeal open is not shown
   (2026-10-17, RBB's request). Without its own link, a list of one kind
   links to that kind's page, as the built-in bands do. Tones alternate
   over the lists that ARE shown, so two neighbours never share one. */
const appealsIn = (list, exclude) => (list.kind ? appealsOf(list.kind) : APPEALS).filter((a) => a.id !== exclude);

/* The lists that have something to show (their count sets the tone of
   the band after them — pages/Appeals). */
export const shownLists = (lists, exclude) => lists.filter((list) => appealsIn(list, exclude).length > 0);

export default function AppealLists({ lists, exclude }) {
  return shownLists(lists, exclude).map((list, i) => {
    const kind = list.kind ? appealKind(list.kind) : null;
    return (
      <AppealGrid
        key={list.id}
        id={list.id}
        tone={i % 2 ? "paper" : "white"}
        kicker={list.kicker}
        heading={list.heading}
        highlight={list.highlight}
        appeals={appealsIn(list, exclude)}
        cta={list.cta ?? (kind && { label: `${APPEALS_PAGES.hub.listCta} ${kind.label}`, to: kind.to })}
        showKind={!kind}
      />
    );
  });
}
