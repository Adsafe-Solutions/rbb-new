import { useParams } from "react-router-dom";
import useSeo from "../../hooks/useSeo.js";
import { RichBlock } from "../../components/RichText/RichText.jsx";
import { formatDate } from "../../lib/dates.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import { notFoundMeta, routeMeta } from "../../content/seo.js";
import {
  BLOGS,
  MEDIA_PAGES,
  NEWS,
  blogById,
  blogCard,
  blogCategory,
  blogPath,
  newsById,
  newsPath,
  programBySlug,
} from "../../content/index.js";

/* One news item (/media/news/:slug) or one blog post (/media/blogs/:slug)
   — the same article template, as a story page reads (pages/StoryDetail):

         paper   PageHeader   the label (program or blog category), the
                              title, the line under it, the date and, for
                              a post, the author; the photograph beside
         white   the article  the body at a reading measure, the first
                              paragraph with a drop cap
         paper   More         three more of the same kind
         accent  ClosingCta

   `kind` is "news" or "blog" (set by the route in App.jsx). A slug that
   is not in content/media.js is the site's ordinary 404. */
const KINDS = {
  news: {
    byId: newsById,
    path: newsPath,
    all: NEWS,
    label: (item) => programBySlug(item.program)?.title,
    lead: (item) => item.summary,
    card: (item) => ({ title: item.title, sample: item.releaseMarker, category: programBySlug(item.program)?.title, excerpt: item.summary, date: item.date, image: item.image, to: newsPath(item) }),
    back: () => MEDIA_PAGES.article.backNews,
    more: () => MEDIA_PAGES.article.moreNews,
  },
  blog: {
    byId: blogById,
    path: blogPath,
    all: BLOGS,
    label: (item) => blogCategory(item.category)?.label,
    lead: (item) => item.excerpt,
    card: blogCard,
    back: () => MEDIA_PAGES.article.backBlogs,
    more: () => MEDIA_PAGES.article.moreBlogs,
  },
};

const paragraphClass = (i) =>
  i === 0
    ? "text-[20px] leading-[1.7] text-copy first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:rounded-lg first-letter:bg-bumble-honey first-letter:px-2.5 first-letter:text-[3.4em] first-letter:font-black first-letter:leading-[0.95] first-letter:text-night"
    : "mt-6 text-[length:var(--text-body)] leading-[1.75] text-copy";

function Detail({ item, kind }) {
  const k = KINDS[kind];
  const t = MEDIA_PAGES.article;
  const label = k.label(item);
  /* Newest first, without this one. */
  const more = [...k.all]
    .filter((other) => other.id !== item.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(k.card);

  return (
    <>
      <PageHeader
        title={item.title}
        parent={k.back()}
        kicker={label}
        crumb={item.title}
        aside={item.image && <EditorialImage image={item.image} caption={item.image.caption} tilt="r" cast="cast-lg" priority sizes="(min-width: 1024px) 40vw, 90vw" />}
      >
        {k.lead(item) && <p className="type-lead mt-7 max-w-[46ch] text-copy">{k.lead(item)}</p>}
        <p className="type-meta mt-8 flex flex-wrap gap-x-5 gap-y-1 text-quiet">
          {item.author && (
            <span>
              {t.byline} <span className="text-fg">{item.author}</span>
            </span>
          )}
          <time dateTime={item.date}>{formatDate(item.date)}</time>
        </p>
      </PageHeader>

      <Section as="article" tone="white" pad="lg">
        <div className="reveal mx-auto max-w-[68ch]">
          {item.releaseMarker && <span hidden data-release-marker={item.releaseMarker} />}
          {item.body.map((paragraph, i) =>
            /* Source content is plain paragraphs; a published CMS post is
               structured rich text (components/RichText). */
            typeof paragraph === "string" ? (
              <p key={paragraph} className={paragraphClass(i)}>
                {paragraph}
              </p>
            ) : (
              <RichBlock key={i} block={paragraph} index={i} paragraphClass={paragraphClass} />
            )
          )}
        </div>
      </Section>

      {more.length > 0 && (
        <Section tone="paper" pad="lg">
          <SectionHeading heading={k.more()} />
          <StoryList stories={more} className="reveal mt-14" />
        </Section>
      )}

      <ClosingCta tone="accent" {...MEDIA_PAGES.news.closing} />
    </>
  );
}

export default function Article({ kind }) {
  const { slug } = useParams();
  const k = KINDS[kind];
  const item = k.byId(slug);
  /* A CMS post's own SEO title/description, when it set them. */
  useSeo(item ? routeMeta(k.path(item), { title: item.seo?.title ?? item.title, description: item.seo?.description ?? k.lead(item), image: item.seo?.image ?? item.image?.src, imageAlt: item.seo?.image ? item.seo.imageAlt : item.image?.alt, noIndex: item.seo?.noIndex }) : notFoundMeta());
  return item ? <Detail item={item} kind={kind} /> : <NotFound />;
}
