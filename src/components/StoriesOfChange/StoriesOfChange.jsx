import { useId } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import Picture from "../Picture/Picture.jsx";

/* Stories, laid out like a magazine page rather than a blog grid: one
   lead story across the width — picture beside it, large headline — and
   the rest as compact rows beneath, picture small on the left.

   `items` are approved stories: { title, category, excerpt, image: { src,
   alt }, to }. With none, `slots` placeholders keep the layout and say a
   story is to come (`fallback`). Placeholders carry no "Read Story" link:
   there is no story to read. */
function Story({ item, fallback, label, readLabel, lead }) {
  const media = lead
    ? "aspect-[4/3] w-full rounded-3xl md:aspect-auto md:h-full md:min-h-[20rem] md:rounded-tr-[5rem]"
    : "aspect-square w-24 shrink-0 rounded-2xl sm:w-32";

  const layout = lead
    ? "grid gap-6 md:grid-cols-[7fr_5fr] md:items-center md:gap-12"
    : "flex items-center gap-5 sm:gap-6";

  if (!item) {
    return (
      <div className={layout}>
        <MediaPlaceholder className={media} />
        <div>
          <p className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
            {label}
          </p>
          <p
            className={cx(
              "mt-2 text-graphite",
              lead && "text-[length:var(--text-subheading)] leading-subheading tracking-subheading"
            )}
          >
            {fallback}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article className={cx("group relative", layout)}>
      {item.image ? (
        <div className={cx("overflow-hidden", media)}>
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
        <MediaPlaceholder className={media} />
      )}
      <div>
        {item.category && (
          <p className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
            {item.category}
          </p>
        )}
        <h3
          className={cx(
            "mt-2 font-bold",
            lead
              ? "text-[length:var(--text-heading)] leading-heading tracking-heading"
              : "text-[length:var(--text-subheading)] leading-subheading tracking-subheading"
          )}
        >
          {item.title}
        </h3>
        {lead && item.excerpt && <p className="mt-4 text-graphite">{item.excerpt}</p>}
        <Link
          to={item.to}
          className="mt-4 inline-flex items-center gap-2 font-semibold text-trust-blue underline-offset-4 after:absolute after:inset-0 group-hover:underline"
        >
          {readLabel}
          <span className="sr-only">: {item.title}</span>
          <LineIcon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

/* `id` is the section's anchor — /impact's stories, where the nav's
   "Impact Stories" lands. */
export default function StoriesOfChange({
  id,
  kicker,
  heading,
  items,
  slots = 3,
  fallback,
  placeholderLabel,
  readLabel,
  cta,
}) {
  const headingId = useId();
  const stories = items.length ? items.slice(0, 3) : Array.from({ length: slots }, () => null);
  const [lead, ...rest] = stories;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[var(--header-h)] bg-mist py-20 md:py-28"
    >
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        <div className="reveal mt-12 rounded-3xl bg-paper-white p-5 sm:p-8 md:mt-14 md:p-10">
          <Story
            item={lead}
            fallback={fallback}
            label={placeholderLabel}
            readLabel={readLabel}
            lead
          />

          {rest.length > 0 && (
            <div className="mt-8 grid gap-6 border-t border-mist pt-8 md:grid-cols-2 md:gap-10">
              {rest.map((item, i) => (
                <Story
                  key={item?.to ?? i}
                  item={item}
                  fallback={fallback}
                  label={placeholderLabel}
                  readLabel={readLabel}
                />
              ))}
            </div>
          )}
        </div>

        {cta && (
          <Button variant="outline" to={cta.to} className="reveal group mt-10 gap-2">
            {cta.label}
            <LineIcon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </Container>
    </section>
  );
}
