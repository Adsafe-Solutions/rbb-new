import { useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useHydrated from "../../hooks/useHydrated.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import CategoryTiles from "../../components/CategoryTiles/CategoryTiles.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import LinkSection from "../../components/LinkSection/LinkSection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import {
  FORMS,
  PROGRAMS,
  STORIES_PAGES,
  STORY_CATEGORIES,
  categoryById,
  featuredStory,
  latestStories,
  storiesIn,
  storyCard,
} from "../../content/index.js";

/* /stories — the Stories hub (Document 07):

         paper   PageHeader       the editorial introduction
     01  white   StoriesOfChange  the ONE story marked `featured`, as the lead
                                  of a publication, or its empty state
     02  paper   StoryList        every approved story, newest first
     03  ink     CategoryTiles    the four story types
     04  white   LinkSection      the program areas behind the stories
     —   accent  Newsletter       the sign-up form once ready, else pending
         paper   ClosingCta       Get Involved · Our Impact

   Everything comes from content/stories.js and shows only APPROVED
   stories. With none, each section says so rather than filling itself.

   Browsing by type is a `?type=` query on this same page — no separate
   pages, no duplicate hub — and the type tiles only become links once a
   type has stories in it. An unknown or empty type shows everything. */
export default function StoriesHub() {
  const t = STORIES_PAGES.hub;
  const browseId = useId();
  const typesId = useId();
  const [params] = useSearchParams();
  const hydrated = useHydrated();

  const featured = featuredStory();
  /* The query applies after hydration — see hooks/useHydrated. */
  const requested = hydrated ? categoryById(params.get("type")) : null;
  const current = requested && storiesIn(requested.id).length ? requested : null;
  const stories = (current ? storiesIn(current.id) : latestStories())
    .filter((story) => story !== featured || current)
    .map(storyCard);

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {t.body}
        </p>
      </PageHeader>

      <StoriesOfChange
        index={1}
        tone="white"
        highlight="focus"
        kicker={t.featured.kicker}
        heading={t.featured.heading}
        items={featured ? [storyCard(featured)] : []}
        slots={1}
        fallback={t.featured.empty}
        placeholderLabel={t.featured.kicker}
        readLabel={STORIES_PAGES.detail.readLabel}
        /* The featured story's image is this page's largest element and,
           on a phone, in the first screen: load it at once (LCP 5.0s → see
           StoryCard `priority`). */
        leadPriority
      />

      <Section id="all-stories" tone="paper" pad="lg" aria-labelledby={browseId}>
          <SectionHeading
            id={browseId}
            index={2}
            kicker={t.browse.kicker}
            heading={current ? current.label : t.browse.heading}
          />
          {current && (
            <p className="reveal mt-6 text-quiet">
              {t.browse.filtered} {current.label.toLowerCase()} ·{" "}
              <Link
                to="/stories"
                className="font-bold text-fg underline decoration-2 underline-offset-4"
              >
                {t.browse.showAll}
              </Link>
            </p>
          )}
          {stories.length > 0 ? (
            <StoryList stories={stories} className="reveal mt-14 md:mt-16" />
          ) : (
            <EmptyPanel text={t.browse.empty} className="reveal mt-14" />
          )}
      </Section>

      <Section tone="ink" pad="lg" watermark="right" aria-labelledby={typesId}>
          <div>
            <SectionHeading
              id={typesId}
              index={3}
              kicker={t.types.kicker}
              heading={t.types.heading}
            />
            <CategoryTiles
              className="reveal mt-14"
              items={STORY_CATEGORIES.map((c) => ({
                ...c,
                count: storiesIn(c.id).length,
                to: `/stories?type=${c.id}#all-stories`,
              }))}
              noneLabel={t.types.none}
              countLabel={t.types.count}
              current={current?.id}
              currentLabel={t.types.current}
            />
          </div>
      </Section>

      <LinkSection
        index={4}
        {...t.related}
        links={PROGRAMS.map(({ title, to, icon }) => ({ title, to, icon }))}
      />

      <Newsletter
        kicker={t.newsletter.kicker}
        heading={t.newsletter.heading}
        pending={t.newsletter.empty}
        src={t.newsletter.image.src}
        alt={t.newsletter.image.alt}
        focal={t.newsletter.image.focal}
        form={FORMS.newsletter}
      />

      {/* Paper, not the default Sky Blue: the newsletter band above is
          already Sky Blue. */}
      <ClosingCta tone="paper" {...t.closing} />
    </>
  );
}
