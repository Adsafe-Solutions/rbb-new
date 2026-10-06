import { useId } from "react";
import { useSearchParams } from "react-router-dom";
import useHydrated from "../../hooks/useHydrated.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import FilterChips from "../../components/FilterChips/FilterChips.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import { BLOGS, BLOG_CATEGORIES, MEDIA_PAGES, blogCard, blogCategory } from "../../content/index.js";

/* /media/blogs — every post, newest first, as story tiles (components/
   StoryList), filtered by category with `?category=` — applied after
   hydration (hooks/useHydrated), like the Stories hub's `?type=`.

         paper   PageHeader   what the blog is
         white   the posts    category chips, a count, the tiles
         accent  ClosingCta   Media Center · Events */
export default function Blogs() {
  const t = MEDIA_PAGES.blogs;
  const headingId = useId();
  const [params] = useSearchParams();
  const hydrated = useHydrated();

  const requested = hydrated ? blogCategory(params.get("category")) : null;
  const current = requested && BLOGS.some((b) => b.category === requested.id) ? requested : null;
  const posts = [...BLOGS]
    .filter((b) => !current || b.category === current.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const chips = [
    { id: null, label: t.all, to: "/media/blogs#posts" },
    ...BLOG_CATEGORIES.filter((c) => BLOGS.some((b) => b.category === c.id)).map((c) => ({
      id: c.id,
      label: c.label,
      to: `/media/blogs?category=${c.id}#posts`,
    })),
  ];

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker} parent={{ label: "Media Center", to: "/media" }}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{t.body}</p>
      </PageHeader>

      <Section id="posts" tone="white" pad="lg" aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">
          {current ? current.label : t.all}
        </h2>
        {BLOGS.length > 0 ? (
          <>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <FilterChips label={t.all} items={chips} current={current?.id ?? null} />
              <p className="type-meta shrink-0 text-quiet" aria-live="polite">
                {t.count(posts.length)}
              </p>
            </div>
            <StoryList stories={posts.map(blogCard)} className="reveal mt-14" />
          </>
        ) : (
          /* No filters over nothing (Document 07): just what will be here. */
          <EmptyPanel text={t.empty.text} cta={t.empty.cta} className="reveal" />
        )}
      </Section>

      <ClosingCta tone="accent" {...MEDIA_PAGES.news.closing} />
    </>
  );
}
