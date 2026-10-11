import { Newspaper } from "../../design-system";
import { formatDate, postsApi, type Post } from "../../content/client";
import { ContentListPage } from "../../content/ListPage";

/* Posts: news and blog articles, managed here once the first is created. */
export default function PostsPage() {
  return (
    <ContentListPage<Post>
      api={postsApi}
      base="posts"
      kind="post"
      plural="Posts"
      description="News and blog articles for the website. Published posts go live when an owner publishes."
      icon={Newspaper}
      emptyDescription="Create a post to share news or a blog article. Once created here, news and blogs on the website are managed from this list."
      types={[
        { value: "news", label: "News" },
        { value: "blog", label: "Blog" },
      ]}
      columns={[
        { label: "Type", cell: (v) => (v.record.type === "blog" ? "Blog" : v.record.type === "news" ? "News" : "Story") },
        { label: "Updated", cell: (v) => formatDate(v.updatedAt) },
        { label: "Published", cell: (v) => formatDate(v.record.publishedAt) },
        { label: "Author", cell: (v) => v.record.author ?? "—" },
      ]}
    />
  );
}
