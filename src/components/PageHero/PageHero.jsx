import Button from "../Button/Button.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import PageHeader from "../PageHeader/PageHeader.jsx";

/* An inner-page hero WITH a photograph: PageHeader's poster band, the
   photograph hung beside the headline as a tilted print.

   Props: { heading, body, cta?, src, alt, parent? }. The photograph is
   the band's largest image — fetched early, never hidden; it only drifts
   a few percent against the scroll once the motion system is up. */
export default function PageHero({ heading, body, cta, src, alt, parent }) {
  return (
    <PageHeader
      title={heading}
      parent={parent}
      aside={
        <EditorialImage
          image={{ src, alt }}
          tilt="r-lg"
          cast="cast-lg"
          priority
          sizes="(min-width: 1024px) 40vw, 90vw"
          data-parallax="5"
        />
      }
    >
      {body && <p className="type-lead mt-7 max-w-[46ch] text-copy">{body}</p>}
      {cta && (
        <Button size="lg" to={cta.to} className="mt-9">
          {cta.label}
        </Button>
      )}
    </PageHeader>
  );
}
