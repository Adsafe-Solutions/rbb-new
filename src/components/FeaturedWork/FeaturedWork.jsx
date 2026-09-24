import { useId } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import Picture from "../Picture/Picture.jsx";

/* A small selection of projects, as an editorial spread rather than an
   even grid: the first piece large on the left, the next two stacked
   beside it.

   `items` are verified projects: { title, description, location?, image:
   { src, alt }, to }. With none, `slots` placeholder cards hold the same
   spread and say what is to come (`fallback`, under `placeholderLabel`). A placeholder has no link
   and no heading — there is nowhere true to send anyone, and three
   identical headings would clutter the outline for no reader's benefit. */
function WorkCard({ item, fallback, label, lead }) {
  const media = cx(
    "w-full overflow-hidden rounded-3xl",
    lead ? "aspect-[16/9] sm:aspect-[4/3] lg:aspect-auto lg:flex-1" : "aspect-[16/9]"
  );

  if (!item) {
    return (
      <div className={cx("flex h-full flex-col", lead && "lg:min-h-[30rem]")}>
        <MediaPlaceholder className={cx(media, lead && "lg:rounded-tl-[6rem]")} />
        <p className="mt-5 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
          {label}
        </p>
        <p className="mt-2 text-graphite">{fallback}</p>
      </div>
    );
  }

  return (
    <article className="group relative flex h-full flex-col">
      {/* A verified project may not have an approved photograph yet; it
          gets the empty frame rather than no frame, so the spread holds. */}
      {item.image ? (
        <div className={cx(media, lead && "lg:rounded-tl-[6rem]")}>
          <Picture
            sizes="(min-width: 1024px) 50vw, 100vw"
            src={item.image.src}
            alt={item.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <MediaPlaceholder className={cx(media, lead && "lg:rounded-tl-[6rem]")} />
      )}
      {item.location && (
        <p className="mt-5 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
          {item.location}
        </p>
      )}
      <h3
        className={cx(
          "mt-2 font-bold",
          lead
            ? "text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm"
            : "text-[length:var(--text-subheading)] leading-subheading tracking-subheading"
        )}
      >
        <Link
          to={item.to}
          className="underline-offset-4 after:absolute after:inset-0 group-hover:underline"
        >
          {item.title}
        </Link>
      </h3>
      {item.description && <p className="mt-2 text-graphite">{item.description}</p>}
    </article>
  );
}

export default function FeaturedWork({
  kicker,
  heading,
  items,
  slots = 3,
  fallback,
  placeholderLabel,
  cta,
}) {
  const headingId = useId();
  const cards = items.length ? items.slice(0, 3) : Array.from({ length: slots }, () => null);
  const [lead, ...rest] = cards;

  return (
    <section aria-labelledby={headingId} className="py-20 md:py-28">
      <Container>
        <div className="reveal flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading id={headingId} kicker={kicker} heading={heading} />
          {cta && (
            <Button variant="outline" to={cta.to} className="group gap-2 self-start md:self-auto">
              {cta.label}
              <LineIcon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}
        </div>

        <div className="reveal mt-12 grid gap-cards md:mt-14 lg:grid-cols-[7fr_5fr]">
          <WorkCard item={lead} fallback={fallback} label={placeholderLabel} lead />
          {rest.length > 0 && (
            <div className="grid gap-cards sm:grid-cols-2 lg:grid-cols-1">
              {rest.map((item, i) => (
                <WorkCard key={item?.to ?? i} item={item} fallback={fallback} label={placeholderLabel} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
