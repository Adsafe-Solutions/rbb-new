import { useId } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import Picture from "../Picture/Picture.jsx";

/* The people behind the organisation. Members are { name, role, bio?,
   image?: { src, alt }, to? } and come straight from content.

   A member with `to` is a link — ONE link per card, on the name, stretched
   over the card by its `after:` box. So the whole card is clickable, Tab
   stops once per person, and the link's name is the person's name rather
   than "Read more". A member without `to` is plain text: no focus stop
   that goes nowhere.

   A member with no photograph gets the Light Gray placeholder frame, never
   a silhouette or someone else's picture. With no members at all the
   section shows `fallback` beside three empty frames — a polished empty
   state, and plainly empty. */
function Member({ member }) {
  return (
    <li className="group relative">
      <div className="aspect-[4/5] overflow-hidden rounded-3xl">
        {member.image ? (
          <Picture
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
            src={member.image.src}
            alt={member.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder className="h-full w-full" />
        )}
      </div>
      <h3 className="mt-5 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
        {member.to ? (
          <Link to={member.to} className="underline-offset-4 after:absolute after:inset-0 group-hover:underline">
            {member.name}
          </Link>
        ) : (
          member.name
        )}
      </h3>
      <p className="mt-1 font-medium text-trust-blue">{member.role}</p>
      {member.bio && <p className="mt-3 text-graphite">{member.bio}</p>}
    </li>
  );
}

export default function TeamGrid({ id, kicker, heading, members, fallback, cta }) {
  const headingId = useId();
  const empty = members.length === 0;

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] py-20 md:py-28">
      <Container>
        <div className="reveal flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading id={headingId} kicker={kicker} heading={heading} />
          {cta && (
            <Button variant="outline" to={cta.to} className="self-start md:self-auto">
              {cta.label}
            </Button>
          )}
        </div>

        {empty ? (
          <div className="reveal mt-12 grid items-center gap-10 md:mt-14 lg:grid-cols-[5fr_7fr] lg:gap-16">
            <p className="max-w-md text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
              {fallback}
            </p>
            {/* Three empty frames, the shape a team row will take. */}
            <div aria-hidden="true" className="grid grid-cols-3 gap-tiles">
              {[0, 1, 2].map((i) => (
                <MediaPlaceholder
                  key={i}
                  className={cx("aspect-[4/5] rounded-3xl", i === 1 && "translate-y-6")}
                />
              ))}
            </div>
          </div>
        ) : (
          <ul className="reveal mt-12 grid gap-cards sm:grid-cols-2 md:mt-14 lg:grid-cols-3 xl:grid-cols-4">
            {members.map((member) => (
              <Member key={member.name} member={member} />
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
