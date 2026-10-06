import PageHero from "../PageHero/PageHero.jsx";

/* The photographic hero the legacy /gifts page opens with. It used to set
   the title over a full-bleed photograph behind a gradient; in the poster
   system a photograph is a print on the wall, never a backdrop, so this
   is PageHero under its old name. Props: { heading, body, src, alt }. */
export default function BannerHero(props) {
  return <PageHero {...props} />;
}
