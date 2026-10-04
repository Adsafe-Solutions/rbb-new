import Container from "../../components/Container/Container.jsx";
import Section from "../../components/Section/Section.jsx";
import Surface from "../../components/Surface/Surface.jsx";
import SectionKicker from "../../components/SectionKicker/SectionKicker.jsx";
import DisplayHeading from "../../components/DisplayHeading/DisplayHeading.jsx";
import HighlightText from "../../components/HighlightText/HighlightText.jsx";
import MarkStamp from "../../components/Mark/MarkStamp.jsx";
import OffsetCard from "../../components/OffsetCard/OffsetCard.jsx";
import FlyerCard, { FlyerLinkCard } from "../../components/FlyerCard/FlyerCard.jsx";
import PosterCard from "../../components/PosterCard/PosterCard.jsx";
import ActionCard from "../../components/ActionCard/ActionCard.jsx";
import StatCard from "../../components/StatCard/StatCard.jsx";
import StepCard from "../../components/StepCard/StepCard.jsx";
import StoryCard from "../../components/StoryCard/StoryCard.jsx";
import ProjectCard from "../../components/ProjectCard/ProjectCard.jsx";
import TeamCard from "../../components/TeamCard/TeamCard.jsx";
import TicketCard from "../../components/TicketCard/TicketCard.jsx";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import Marquee from "../../components/Marquee/Marquee.jsx";
import Button from "../../components/Button/Button.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import DonationCheckout from "../../components/DonationCheckout/DonationCheckout.jsx";
import {
  DONATION,
  HOMEPAGE,
  PROGRAMS,
  PROJECTS,
  SITE,
  impactStats,
  latestStories,
  pathCards,
  projectPath,
  storyCard,
} from "../../content/index.js";
import { RBB_PHOTOS } from "../../content/photos.js";

/* The live component catalogue at /components — the poster system's
   primitives, each rendered with RBB's own working content rather than
   described in prose. Companion to /design-system, which covers the
   tokens these are built from.

   Every page section on the public site is composed from what is on
   this page; a card that looks different somewhere else is a bug.

   Off in production builds by default, same as /design-system — see
   config/sections.js. */
function Block({ index, name, note, tone = "white", children }) {
  return (
    <Section tone={tone} pad="md">
      <SectionKicker index={index}>{name}</SectionKicker>
      {note && <p className="mt-3 max-w-[70ch] text-quiet">{note}</p>}
      <div className="mt-10">{children}</div>
    </Section>
  );
}

export default function Components() {
  const stats = impactStats();
  const stories = latestStories(2).map(storyCard);
  const project = PROJECTS[0];
  const paths = pathCards();

  return (
    <>
      <Section tone="paper" pad="lg" className="-mt-[var(--header-h)] pt-[calc(var(--header-h)+4rem)]" watermark="right">
        <SectionKicker>Rising Beyond Borders</SectionKicker>
        <h1 className="type-billboard mt-5">
          The <HighlightText>components</HighlightText>
        </h1>
      </Section>

      <Block index={1} name="Type & marks" note="DisplayHeading, HighlightText, SectionKicker, MarkStamp.">
        <DisplayHeading as="p" size="title" highlight={2}>
          Change begins with people.
        </DisplayHeading>
        <div className="mt-8 flex items-center gap-6">
          <MarkStamp className="h-16 w-16" />
          <SectionKicker index={3}>Our approach</SectionKicker>
        </div>
      </Block>

      <Block index={2} name="Buttons" tone="paper" note="solid · ink · outline · link, in three sizes. The tones turn them around.">
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg">Solid large</Button>
          <Button>Solid</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="link">Text link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Surface tone="ink" className="mt-8 flex flex-wrap gap-4 rounded-2xl p-6">
          <Button>Solid</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="outline">Outline</Button>
        </Surface>
        <Surface tone="accent" className="mt-6 flex flex-wrap gap-4 rounded-2xl p-6">
          <Button>Solid</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="outline">Outline</Button>
        </Surface>
      </Block>

      <Block index={3} name="Flyers" tone="ink" note="FlyerCard, FlyerLinkCard — tilted, straightening on hover.">
        <div className="grid gap-10 md:grid-cols-3">
          <FlyerLinkCard tilt="l" icon={PROGRAMS[0].icon} meta="01" title={PROGRAMS[0].title} to={PROGRAMS[0].to} label="Explore">
            {PROGRAMS[0].description}
          </FlyerLinkCard>
          <FlyerCard tilt="r" title={PROGRAMS[1].title}>
            {PROGRAMS[1].description}
          </FlyerCard>
          <FlyerCard tilt="r" number={3} title={PROGRAMS[2].title} />
        </div>
      </Block>

      <Block index={4} name="Posters, tickets, actions" note="PosterCard, TicketCard, ActionCard.">
        <div className="grid gap-10 lg:grid-cols-3">
          <PosterCard kicker="Mission" tone="ink">
            <p className="type-card">{HOMEPAGE.whoWeAre.body[0]}</p>
          </PosterCard>
          <TicketCard
            kicker="Transparency"
            rows={SITE.transparencyLinks.map((l) => (
              <p key={l.title} className="font-extrabold text-fg">
                {l.title}
              </p>
            ))}
            foot={<p className="type-meta text-quiet">{SITE.transparencyLinkMeta}</p>}
          />
          <ActionCard tone="accent" title={paths[0].title} body={paths[0].description} to={paths[0].to} icon={paths[0].icon} label={paths[0].cta} />
        </div>
      </Block>

      <Block index={5} name="Stats & steps" tone="paper" note="StatCard carries its verification status on its face; StepCard never tilts.">
        <div className="grid gap-10 md:grid-cols-2">
          <StatCard {...stats[0]} tone="accent" pending={SITE.figurePending} />
          <StepCard number={1} title="Amount" note="A numbered sheet for a step of a form, a clause of a policy.">
            <p className="text-copy">Step content.</p>
          </StepCard>
        </div>
      </Block>

      <Block index={6} name="Prints" note="EditorialImage, StoryCard, ProjectCard, TeamCard.">
        <div className="grid gap-12 md:grid-cols-3">
          <EditorialImage image={RBB_PHOTOS.kids} tilt="r-lg" label={PROGRAMS[3].title} />
          {stories[0] && <StoryCard story={stories[0]} />}
          {project && <ProjectCard project={project} href={projectPath(project)} tilt="l" />}
        </div>
        <div className="mt-12 grid gap-12 md:grid-cols-3">
          <TeamCard name="Name to be supplied" role="Role to be supplied" tilt="r" />
          <OffsetCard pad="md">
            <LinkChips align="start" items={PROGRAMS.map((p) => ({ title: p.title, to: p.to, icon: p.icon }))} />
          </OffsetCard>
          <EmptyPanel text={SITE.placeholder} />
        </div>
      </Block>

      {/* The checkout as the donation page draws it. It asks the donation
          API for its configuration at run time: with VITE_DONATIONS_API
          unset (the default) it says donations are unavailable, which is
          the honest state to show here. Nothing on this page can create an
          order unless a configured server is behind that variable. */}
      <Block index={7} name="Donation checkout" tone="ink" note="DonationCheckout — Razorpay; UI only here.">
        <div className="max-w-xl">
          <DonationCheckout copy={DONATION.donationAction.checkout} />
        </div>
      </Block>

      <Section tone="ink" pad="none" bare>
        <Marquee items={PROGRAMS.map((p) => p.title)} />
      </Section>

      <Container className="py-10">
        <p className="type-meta text-quiet">Development route — not in production builds.</p>
      </Container>
    </>
  );
}
