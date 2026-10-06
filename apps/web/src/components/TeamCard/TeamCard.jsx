import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Picture from "../Picture/Picture.jsx";

/* A person: a portrait as a print, their name in display type, their
   role in small capitals.

   Every portrait is the same 4:5 crop in the same frame, so a team reads
   as a set whatever photographs RBB supplies. A person with no approved
   photograph gets the pale-mark placeholder — never initials dressed up
   as a picture, and never a stock face.

     name, role   as content/team.js gives them
     image        { src, alt } — optional
     to           their profile, if they have an approved one. With it
                  the card is a link (the name, stretched) and lifts.

   Nothing here invents a person: the caller passes approved members
   only. */
export default function TeamCard({ name, role, image, to, tilt, sample, headingAs: Heading = "h3", className = "" }) {
  return (
    <OffsetCard as="article" pad="none" tilt={tilt} lift={Boolean(to)} data-release-marker={sample} className={cx("group flex h-full flex-col overflow-hidden", className)}>
      <div className="relative aspect-[4/5] border-b-2 border-[var(--tone-rim)]">
        {image?.src ? (
          <Picture
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw"
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <MediaPlaceholder className="absolute inset-0" />
        )}
      </div>
      <div className="p-5 md:p-6">
        <Heading className="type-card">
          {to ? (
            <Link to={to} className="after:absolute after:inset-0 after:rounded-2xl">
              {name}
            </Link>
          ) : (
            name
          )}
        </Heading>
        {role && <p className="type-meta mt-2 text-quiet">{role}</p>}
      </div>
    </OffsetCard>
  );
}
