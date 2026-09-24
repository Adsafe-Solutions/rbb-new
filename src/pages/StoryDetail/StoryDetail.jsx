import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import StoryList, { formatDate } from "../../components/StoryList/StoryList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta, storyMeta } from "../../content/seo.js";
import useReveal from "../../hooks/useReveal.js";
import {
  PROJECTS,
  STORIES_PAGES,
  categoryById,
  programBySlug,
  projectPath,
  storyBySlug,
  storyCard,
} from "../../content/index.js";
import Picture from "../../components/Picture/Picture.jsx";

/* /stories/:slug — one approved story (Document 07's detail template),
   built entirely from its entry in content/stories.js.

   A slug that is not an APPROVED story is the site's ordinary 404 — never
   a placeholder story at a made-up address. Until RBB supplies stories,
   that is every slug.

   Every section renders only if the story has that field: hero (title,
   category, date, author, image), introduction (excerpt), body, location,
   related work (verified program/project links), impact, quotes, media,
   related stories. The body runs at a readable measure — a story is read,
   not scanned. */
function Detail({ story }) {
  useReveal();
  const t = STORIES_PAGES.detail;
  const category = categoryById(story.category);
  const program = story.programId && programBySlug(story.programId);
  const project = story.projectId && PROJECTS.find((p) => p.slug === story.projectId);
  const related = (story.relatedStoryIds ?? []).map(storyBySlug).filter(Boolean).map(storyCard);

  const relatedWork = [
    program && { title: program.title, to: program.to, icon: program.icon },
    project && { title: project.title, to: projectPath(project) },
  ].filter(Boolean);

  const rows = [
    story.location && { id: "location", heading: t.location, body: story.location },
    story.impact?.length && { id: "impact", heading: t.impact, items: story.impact },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={story.title}
        parent={{ label: "Stories", to: "/stories" }}
        kicker={category?.label}
        aside={
          story.image && (
            <figure className="reveal">
              <div className="aspect-[4/3] overflow-hidden rounded-3xl rounded-tr-[6rem]">
                <Picture sizes="(min-width: 1024px) 40vw, 90vw" src={story.image.src} alt={story.image.alt} className="h-full w-full object-cover" />
              </div>
              {story.image.caption && (
                <figcaption className="mt-3 text-[length:var(--text-caption)] leading-caption text-graphite">
                  {story.image.caption}
                </figcaption>
              )}
            </figure>
          )
        }
      >
        {story.excerpt && (
          <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
            {story.excerpt}
          </p>
        )}
        {(story.date || story.author) && (
          <p className="mt-6 flex flex-wrap gap-x-4 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
            {story.author && (
              <span>
                {t.byline} <span className="font-semibold text-bumble-ink">{story.author}</span>
              </span>
            )}
            {story.date && <time dateTime={story.date}>{formatDate(story.date)}</time>}
          </p>
        )}
      </PageHeader>

      {(story.body?.length > 0 || story.quotes?.length > 0) && (
        <article className="py-16 md:py-24">
          <Container>
            <div className="reveal mx-auto max-w-[68ch]">
              {(story.body ?? []).map((paragraph) => (
                <p key={paragraph} className="mt-6 text-[length:var(--text-body)] leading-[1.7] first:mt-0">
                  {paragraph}
                </p>
              ))}
              {story.quotes?.map((quote) => (
                <figure key={quote.text} className="mt-10 border-l-4 border-bumble-honey pl-6">
                  <blockquote className="font-semibold text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-trust-blue">
                    {quote.text}
                  </blockquote>
                  {quote.attribution && (
                    <figcaption className="mt-3 text-graphite">— {quote.attribution}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </Container>
        </article>
      )}

      {rows.length > 0 && <ContentRows rows={rows} />}

      {relatedWork.length > 0 && (
        <section className="pb-16 md:pb-24">
          <Container>
            <SectionHeading heading={t.related} className="reveal" />
            <LinkChips items={relatedWork} align="start" surface="paper" className="reveal mt-8" />
          </Container>
        </section>
      )}

      {story.media?.length > 0 && (
        <section className="pb-16 md:pb-24">
          <Container>
            <SectionHeading heading={t.media} className="reveal" />
            <div className="reveal mt-8 grid gap-tiles sm:grid-cols-2 lg:grid-cols-3">
              {story.media.map((item) => (
                <figure key={item.src}>
                  <Picture sizes="(min-width: 768px) 33vw, 90vw" src={item.src} alt={item.alt} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                  {item.caption && (
                    <figcaption className="mt-2 text-[length:var(--text-caption)] leading-caption text-graphite">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </Container>
        </section>
      )}

      {related.length > 0 && (
        <section className="pb-16 md:pb-24">
          <Container>
            <SectionHeading heading={t.relatedStories} className="reveal" />
            <StoryList stories={related} className="reveal mt-10" />
          </Container>
        </section>
      )}

      <ClosingCta {...t.closing} />
    </>
  );
}

export default function StoryDetail() {
  const { slug } = useParams();
  const story = storyBySlug(slug);
  useSeo(story ? storyMeta(story) : notFoundMeta());

  return story ? <Detail story={story} /> : <NotFound />;
}
