import { useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useHydrated from "../../hooks/useHydrated.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import CategoryTiles from "../../components/CategoryTiles/CategoryTiles.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import LinkSection from "../../components/LinkSection/LinkSection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
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

     01  mist band  PageHeader       the editorial introduction
     02  mist band  StoriesOfChange  the ONE story marked `featured`, or its
                                     intentional empty state
     03  white      StoryList        every approved story, newest first
     04  white      CategoryTiles    the four story types
     05  white      LinkSection      the program areas behind the stories
     06  mist band  Newsletter       the newsletter card — the sign-up form
                                     once ready (content/forms.js), else pending
     07  mist band  ClosingCta       Get Involved · Our Impact

   Everything comes from content/stories.js and shows only APPROVED
   stories. With none, each section says so rather than filling itself.

   Browsing by type is a `?type=` query on this same page — no separate
   pages, no duplicate hub — and the type tiles only become links once a
   type has stories in it. An unknown or empty type shows everything. */
export default function StoriesHub() {
  useReveal();
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
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {t.body}
        </p>
      </PageHeader>

      <StoriesOfChange
        kicker={t.featured.kicker}
        heading={t.featured.heading}
        items={featured ? [storyCard(featured)] : []}
        slots={1}
        fallback={t.featured.empty}
        placeholderLabel={t.featured.kicker}
        readLabel={STORIES_PAGES.detail.readLabel}
      />

      <section
        id="all-stories"
        aria-labelledby={browseId}
        className="scroll-mt-[var(--header-h)] py-20 md:py-28"
      >
        <Container>
          <SectionHeading
            id={browseId}
            kicker={t.browse.kicker}
            heading={current ? current.label : t.browse.heading}
            className="reveal"
          />
          {current && (
            <p className="reveal mt-4 text-graphite">
              {t.browse.filtered} {current.label.toLowerCase()} ·{" "}
              <Link
                to="/stories"
                className="font-semibold text-trust-blue underline underline-offset-4"
              >
                {t.browse.showAll}
              </Link>
            </p>
          )}
          {stories.length > 0 ? (
            <StoryList stories={stories} className="reveal mt-12 md:mt-14" />
          ) : (
            <EmptyPanel text={t.browse.empty} className="reveal mt-12 md:mt-14" />
          )}
        </Container>
      </section>

      <section aria-labelledby={typesId} className="pb-20 md:pb-28">
        <Container>
          <div>
            <SectionHeading
              id={typesId}
              kicker={t.types.kicker}
              heading={t.types.heading}
              className="reveal"
            />
            <CategoryTiles
              className="reveal mt-10"
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
        </Container>
      </section>

      <LinkSection
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

      <ClosingCta {...t.closing} />
    </>
  );
}
