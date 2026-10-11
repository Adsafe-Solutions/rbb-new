import AppealGrid from "../AppealGrid/AppealGrid.jsx";
import { APPEALS, APPEALS_PAGES, appealKind, appealsOf } from "../../content/index.js";

/* Milestone 7 — a CMS donation page's own appeal lists (the contract's
   `appealList` sections, in order), in place of the page's built-in appeal
   bands. Each lists the published appeals of its kind, or all of them;
   `exclude` leaves out the appeal whose page this is. A list of one kind
   with nothing in it says so as the built-in band does (the kind's own
   empty line); a list of every appeal with nothing in it is left out.
   Without its own link, a list of one kind links to that kind's page, as
   the built-in bands do. */
export default function AppealLists({ lists, exclude }) {
  return lists.map((list, i) => {
    const kind = list.kind ? appealKind(list.kind) : null;
    const appeals = (kind ? appealsOf(list.kind) : APPEALS).filter((a) => a.id !== exclude);
    if (!kind && appeals.length === 0) return null;
    return (
      <AppealGrid
        key={list.id}
        id={list.id}
        tone={i % 2 ? "paper" : "white"}
        kicker={list.kicker}
        heading={list.heading}
        highlight={list.highlight}
        appeals={appeals}
        empty={kind?.empty}
        cta={list.cta ?? (kind && { label: `${APPEALS_PAGES.hub.listCta} ${kind.label}`, to: kind.to })}
        showKind={!kind}
      />
    );
  });
}
