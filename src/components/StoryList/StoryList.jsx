import { cx } from "../../lib/cx.js";
import StoryCard from "../StoryCard/StoryCard.jsx";
import { formatDate } from "../../lib/dates.js";

/* Story cards in a grid — the /stories list and a story page's related
   stories. Cards are { title, category?, excerpt?, date?, image?, to }
   (content/stories.js `storyCard`); each is a StoryCard tile, the
   photograph as a print. A story with no photograph gets the pale-mark
   frame rather than a stretched-out text card, so the grid keeps its
   rhythm. */
export default function StoryList({ stories, className = "" }) {
  return (
    <ul className={cx("grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {stories.map((story) => (
        <li key={story.to}>
          <StoryCard story={story} />
        </li>
      ))}
    </ul>
  );
}

export { formatDate };
