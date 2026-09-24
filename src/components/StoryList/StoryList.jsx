import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Picture from "../Picture/Picture.jsx";

/* Story cards in a grid — the /stories list and a story page's related
   stories. Cards are { title, category?, excerpt?, date?, image?, to }.

   Editorial, not a photo wall: a story WITHOUT an image is a text card,
   not a card with an empty frame (Document 07 — do not force every card
   to carry a picture). Category, date and excerpt each render only when
   present, so a story with just a title is still a tidy card.

   Each card is one link, on the title, stretched over the card: one Tab
   stop, named for the story. */
const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function StoryList({ stories, className = "" }) {
  return (
    <ul className={cx("grid gap-cards sm:grid-cols-2 lg:grid-cols-3", className)}>
      {stories.map((story) => (
        <li
          key={story.to}
          className={cx(
            "group relative flex flex-col overflow-hidden rounded-3xl",
            story.image ? "bg-paper-white" : "bg-mist p-7 md:p-8"
          )}
        >
          {story.image && (
            <div className="aspect-[3/2] overflow-hidden rounded-3xl">
              <Picture
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                src={story.image.src}
                alt={story.image.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
          )}

          <div className={cx("flex flex-1 flex-col", story.image && "pt-5")}>
            {(story.category || story.date) && (
              <p className="flex flex-wrap gap-x-3 text-[length:var(--text-caption)] leading-caption tracking-caption">
                {story.category && (
                  <span className="font-semibold uppercase tracking-[0.16em] text-trust-blue">
                    {story.category}
                  </span>
                )}
                {story.date && (
                  <time dateTime={story.date} className="text-graphite">
                    {formatDate(story.date)}
                  </time>
                )}
              </p>
            )}
            <h3 className="mt-2 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
              <Link to={story.to} className="underline-offset-4 after:absolute after:inset-0 group-hover:underline">
                {story.title}
              </Link>
            </h3>
            {story.excerpt && <p className="mt-3 text-graphite">{story.excerpt}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export { formatDate };
