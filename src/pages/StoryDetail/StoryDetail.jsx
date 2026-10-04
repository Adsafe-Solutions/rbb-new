import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import Mark from "../../components/Mark/Mark.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import StoryList, { formatDate } from "../../components/StoryList/StoryList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta, storyMeta } from "../../content/seo.js";
import {
  PROJECTS,
  STORIES_PAGES,
  categoryById,
  programBySlug,
  projectPath,
  storyBySlug,
  storyCard,
} from "../../content/index.js";

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
            <EditorialImage
              image={story.image}
              caption={story.image.caption}
              tilt="r-lg"
              cast="cast-lg"
              priority
              label={category?.label}
              sizes="(min-width: 1024px) 40vw, 90vw"
              data-parallax="5"
            />
          )
        }
      >
        {story.excerpt && (
          <p className="type-lead mt-7 max-w-[46ch] text-copy">
            {story.excerpt}
          </p>
        )}
        {(story.date || story.author) && (
          <p className="type-meta mt-8 flex flex-wrap gap-x-5 gap-y-1 text-quiet">
            {story.author && (
              <span>
                {t.byline} <span className="text-fg">{story.author}</span>
              </span>
            )}
            {story.date && <time dateTime={story.date}>{formatDate(story.date)}</time>}
          </p>
        )}
      </PageHeader>

      {/* The article: a reading measure, a drop-cap opening paragraph, and
          each quote as a pull-quote — display weight on a Sky Blue rule,
          the mark beside it. */}
      {(story.body?.length > 0 || story.quotes?.length > 0) && (
        <Section as="article" tone="white" pad="lg">
          <div className="reveal mx-auto max-w-[68ch]">
            {/* The release marker, for HTML scans only: `hidden` keeps it
                off the screen and out of the accessibility tree. */}
            {story.releaseMarker && <span hidden data-release-marker={story.releaseMarker} />}
            {(story.body ?? []).map((paragraph, i) => (
              <p
                key={paragraph}
                className={
                  i === 0
                    ? "text-[20px] leading-[1.7] text-copy first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:rounded-lg first-letter:bg-bumble-honey first-letter:px-2.5 first-letter:text-[3.4em] first-letter:font-black first-letter:leading-[0.95] first-letter:text-night"
                    : "mt-6 text-[length:var(--text-body)] leading-[1.75] text-copy"
                }
              >
                {paragraph}
              </p>
            ))}
            {story.quotes?.map((quote) => (
              <figure key={quote.text} className="my-12 border-l-[6px] border-pop pl-6 md:-mx-10 md:pl-10">
                <Mark className="h-8 w-8 text-pop" />
                <blockquote className="type-card mt-4 normal-case">{quote.text}</blockquote>
                {quote.attribution && <figcaption className="type-meta mt-4 text-quiet">— {quote.attribution}</figcaption>}
              </figure>
            ))}
          </div>
        </Section>
      )}

      {rows.length > 0 && <ContentRows tone="paper" rows={rows} />}

      {relatedWork.length > 0 && (
        <Section tone="white" pad="md">
          <SectionHeading heading={t.related} size="card" />
          <LinkChips items={relatedWork} align="start" className="reveal mt-8" />
        </Section>
      )}

      {story.media?.length > 0 && (
        <Section tone="paper" pad="md">
          <SectionHeading heading={t.media} size="card" />
          <div data-anim-stagger className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {story.media.map((item, i) => (
              <div key={item.src}>
                <EditorialImage image={item} caption={item.caption} tilt={i % 2 ? "r" : "l"} sizes="(min-width: 768px) 33vw, 90vw" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section tone="white" pad="lg">
          <SectionHeading heading={t.relatedStories} />
          <StoryList stories={related} className="reveal mt-14" />
        </Section>
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
