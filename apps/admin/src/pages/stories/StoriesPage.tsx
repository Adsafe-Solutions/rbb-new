import { BookOpen } from "../../design-system";
import { formatDate, storiesApi, type Post } from "../../content/client";
import { ContentListPage } from "../../content/ListPage";
import { categoryLabel } from "../../stories/categories";

/* /stories — the website's stories (/stories, /stories/<slug>, the
   homepage's newest stories, /impact's stories). Newest first by date on
   the website, undated ones in the order they were added; there is no
   manual order. Until a story is PUBLISHED here and an owner publishes
   the website, the website keeps its own stories. */
export default function StoriesPage() {
  return (
    <ContentListPage<Post>
      api={storiesApi}
      base="stories"
      kind="story"
      plural="Stories"
      description="Stories from the work, newest first on the website. Until a story is published here, the website keeps its own."
      icon={BookOpen}
      confirmArchive
      emptyDescription="Create a story once the organization has approved one — with the consent of anyone it describes. Until one is published here, the website keeps its own stories."
      columns={[
        { label: "Type", cell: (v) => categoryLabel(v.record.category) },
        { label: "Date", cell: (v) => formatDate(v.record.date) },
        { label: "Updated", cell: (v) => formatDate(v.updatedAt) },
        { label: "Published", cell: (v) => formatDate(v.record.publishedAt) },
      ]}
    />
  );
}
