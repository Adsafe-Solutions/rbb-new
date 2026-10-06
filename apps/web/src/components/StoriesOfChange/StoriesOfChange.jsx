import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import StoryCard from "../StoryCard/StoryCard.jsx";

/* Stories set like the front of a publication: one lead story across the
   page — the print beside a headline in display type — and the rest as
   compact rows under a rule, the way a magazine runs its shorter items.

   `items` are approved stories (content/stories.js `storyCard`). With
   none, the section keeps its heading and says a story is to come
   (`fallback`) — no placeholder stories, and no "Read" link to nowhere.
   `slots`, `placeholderLabel` are accepted for the pages that pass them.

   `id` is the section's anchor — /impact's stories, where the nav's
   "Impact Stories" lands. */
export default function StoriesOfChange({
  id,
  index,
  kicker,
  heading,
  items,
  fallback,
  readLabel,
  cta,
  tone = "paper",
  highlight,
  leadPriority = false,
}) {
  const headingId = useId();
  const [lead, ...rest] = items.slice(0, 3);

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading
        id={headingId}
        index={index}
        kicker={kicker}
        heading={heading}
        highlight={highlight}
      />

      {lead ? (
        <>
          <div className={leadPriority ? "mt-14 md:mt-16" : "reveal mt-14 md:mt-16"}>
            <StoryCard
              story={lead}
              layout="lead"
              readLabel={readLabel}
              priority={leadPriority}
            />
          </div>
          {rest.length > 0 && (
            <ul
              data-anim-stagger
              className="mt-14 grid gap-10 border-t-2 border-edge pt-10 md:grid-cols-2 md:gap-14"
            >
              {rest.map((story) => (
                <li key={story.to}>
                  <StoryCard story={story} layout="row" />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <EmptyPanel text={fallback} className="reveal mt-14" />
      )}

      {cta && (
        <Button variant="outline" to={cta.to} className="reveal mt-14">
          {cta.label}
        </Button>
      )}
    </Section>
  );
}
