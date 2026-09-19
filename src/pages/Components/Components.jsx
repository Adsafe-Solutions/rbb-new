import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import useReveal from "../../hooks/useReveal.js";
import Badge from "../../components/Badge/Badge.jsx";
import Brand from "../../components/Brand/Brand.jsx";
import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";
import Photo from "../../components/Photo/Photo.jsx";
import PhoneMock from "../../components/PhoneMock/PhoneMock.jsx";
import Seal from "../../components/Seal/Seal.jsx";
import Sparkle from "../../components/Sparkle/Sparkle.jsx";
import Header from "../../components/Header/Header.jsx";
import Hero from "../../components/Hero/Hero.jsx";
import HeroBleed from "../../components/HeroBleed/HeroBleed.jsx";
import Mission from "../../components/Mission/Mission.jsx";
import MemberCircle from "../../components/MemberCircle/MemberCircle.jsx";
import Products from "../../components/Products/Products.jsx";
import Story from "../../components/Story/Story.jsx";
import GetApp from "../../components/GetApp/GetApp.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner.jsx";
import AccountabilityBand from "../../components/AccountabilityBand/AccountabilityBand.jsx";
import AboutIntro from "../../components/AboutIntro/AboutIntro.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import DonateWidget from "../../components/DonateWidget/DonateWidget.jsx";
import CampaignHero from "../../components/CampaignHero/CampaignHero.jsx";
import ActionCard from "../../components/ActionCard/ActionCard.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import FightFor from "../../components/FightFor/FightFor.jsx";
import AppealSpotlight from "../../components/AppealSpotlight/AppealSpotlight.jsx";
import LegacyCollage from "../../components/LegacyCollage/LegacyCollage.jsx";
import ImpactMosaic from "../../components/ImpactMosaic/ImpactMosaic.jsx";
import PageHero from "../../components/PageHero/PageHero.jsx";
import FeatureGrid from "../../components/FeatureGrid/FeatureGrid.jsx";
import ProjectGrid from "../../components/ProjectGrid/ProjectGrid.jsx";
import NisabCallout from "../../components/NisabCallout/NisabCallout.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import BannerHero from "../../components/BannerHero/BannerHero.jsx";
import Prose from "../../components/Prose/Prose.jsx";
import SignupCard from "../../components/SignupCard/SignupCard.jsx";
import Steps from "../../components/Steps/Steps.jsx";
import Testimonials from "../../components/Testimonials/Testimonials.jsx";
import BlogGrid from "../../components/BlogGrid/BlogGrid.jsx";
import ContactDetails from "../../components/ContactDetails/ContactDetails.jsx";
import LinkCards from "../../components/LinkCards/LinkCards.jsx";
import SplitFeature from "../../components/SplitFeature/SplitFeature.jsx";
import OptionStrip from "../../components/OptionStrip/OptionStrip.jsx";
import { NGO, ZAKAT, VOLUNTEER, BLOGS, CONTACT, GIFTS } from "../../content/index.js";

/* The live component catalog at /components — every component in
   src/components/, rendered with its real variants rather than described
   in prose. Companion to /design-system, which covers the tokens these
   components are built from; this covers what's built out of them.

   ⚠ Several page sections below (Mission, MemberCircle, Products, Story,
   GetApp) render with a `.reveal` root that starts at opacity 0 until
   hooks/useReveal.js's observer marks it `.in`. Home wires that observer up
   itself; this page has to as well or every one of them sits invisible.

   The page sections are also framed here rather than left full-bleed —
   real usage runs edge to edge on the homepage, but boxing them lets more
   than one fit on a screen at a time, which is the point of a catalog.

   Off in production builds by default, same as /design-system — see
   config/sections.js. */

function Section({ title, note, children }) {
  return (
    <section className="py-12">
      <h2 className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
        {title}
      </h2>
      {note && <p className="mt-3 max-w-prose text-graphite">{note}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Frame({ label, children }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-mist bg-paper-white">
      <p className="px-6 pt-5 font-medium">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const PHOTO_RATIOS = [
  ["4/5", "portrait-seafront"],
  ["3/4", "interest-outdoors"],
  ["1/1", "member-circle-dinner"],
  ["9/19", "app-list"],
];

export default function Components() {
  useReveal();

  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          Components
        </h1>
        <Link
          to="/design-system"
          className="text-[length:var(--text-caption)] tracking-caption text-graphite hover:underline"
        >
          Design system tokens →
        </Link>
      </div>
      <p className="mt-4 max-w-prose text-graphite">
        Every component in <code>src/components/</code>, rendered with its real
        variants. If one looks wrong here, the component is wrong — there is
        no second copy to check against.
      </p>

      <Section
        title="Button"
        note="One filled button in the system, and it is ink. Yellow is the brand's warmth, not its clickability — see the Don'ts in design/DESIGN.md before reaching for a second fill."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Button>Solid (default)</Button>
          <Button variant="link" href="#components">
            Underlined link
          </Button>
        </div>

        <div className="mt-6 inline-flex rounded-2xl bg-bumble-ink p-4">
          <Button variant="inverse">Inverse</Button>
        </div>

        <div className="mt-6 inline-flex items-center gap-1 rounded-2xl bg-mist p-1.5">
          <Button variant="pill">Active pill</Button>
          <Button variant="ghost">Inactive link</Button>
        </div>
      </Section>

      <Section
        title="Badge"
        note="The only pill shape in the system — always metadata, never something to press."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Paper (default)</Badge>
          <Badge tone="honey">Honey</Badge>
          <Badge tone="ink">Ink</Badge>
        </div>

        <div className="relative mt-6 w-32">
          <Photo label="interest-outdoors" ratio="3/4">
            <Badge tone="honey" vertical className="absolute -right-3 top-6 shadow-sm">
              Vertical
            </Badge>
          </Photo>
        </div>
      </Section>

      <Section
        title="Brand"
        note="The wordmark, as live type rather than a logo file. `size` picks the treatment, not just a font size."
      >
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
              nav
            </p>
            <Brand size="nav" as="span" />
          </div>
          <div>
            <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
              footer
            </p>
            <Brand size="footer" as="span" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
              display
            </p>
            <Brand size="display" as="span" />
          </div>
        </div>
      </Section>

      <Section
        title="Photo"
        note="A photograph, or a tonal stand-in at the right aspect ratio when a real image hasn't landed yet — the layout holds its true shape either way."
      >
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PHOTO_RATIOS.map(([ratio, label]) => (
            <li key={ratio}>
              <Photo label={label} ratio={ratio} />
              <p className="mt-2 text-[length:var(--text-caption)] tracking-caption text-graphite">
                ratio={ratio}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="PhoneMock"
        note="A drawn bezel around a Photo, never an imported image, so the radius and the screen inside it change together."
      >
        <div className="flex flex-wrap items-end gap-6">
          <PhoneMock label="app-list" className="w-28" />
          <PhoneMock label="app-chat" className="w-36" />
        </div>
      </Section>

      <Section
        title="Seal"
        note="The Member Circle mark. Drawn as SVG with the ring text on a `textPath` so it stays crisp at any size."
      >
        <Seal />
      </Section>

      <Section
        title="Sparkle"
        note="The one decorative mark. `currentColor`, so a `text-*` class picks the colour; size and placement come from `className`."
      >
        <div className="flex flex-wrap items-end gap-8">
          <Sparkle className="w-24" />
          <div className="rounded-3xl bg-bumble-ink p-6">
            <Sparkle className="w-24 text-paper-white" />
          </div>
          <div className="relative h-32 w-48 overflow-hidden rounded-3xl bg-mist">
            <Sparkle className="absolute -bottom-6 -right-6 w-28" />
          </div>
        </div>
      </Section>

      <Section
        title="Container"
        note="The 1200px column and its side gutter. Full-bleed bands run edge to edge and put one of these inside themselves for their own copy — shown here against a honey band scaled to this page's own width rather than the viewport's."
      >
        <div className="rounded-2xl bg-mist py-6">
          <Container>
            <div
              className={cx(
                "rounded-lg border-2 border-dashed border-bumble-ink/40",
                "bg-paper-white/60 py-4 text-center",
                "text-[length:var(--text-caption)] tracking-caption"
              )}
            >
              max-w-[var(--page-max-width)], px-5 md:px-8
            </div>
          </Container>
        </div>
      </Section>

      <Section
        title="Page sections"
        note="The composed sections that stack into the homepage, in the order they appear there."
      >
        <div className="flex flex-col gap-6">
          <Frame label="Header">
            <Header />
          </Frame>
          <Frame label="Hero">
            <Hero />
          </Frame>
          <Frame label="HeroBleed">
            <HeroBleed />
          </Frame>
          <Frame label="Mission">
            <Mission />
          </Frame>
          <Frame label="MemberCircle">
            <MemberCircle />
          </Frame>
          <Frame label="Products">
            <Products />
          </Frame>
          <Frame label="Story">
            <Story />
          </Frame>
          <Frame label="GetApp">
            <GetApp />
          </Frame>
          <Frame label="Footer">
            <Footer />
          </Frame>
        </div>
      </Section>

      <Section
        title="NGO sections"
        note="The sections that stack into the homepage below the hero. Each takes its content as props, so the same component serves several programmes — FeatureBanner and ImpactStats both appear more than once on the page."
      >
        <div className="flex flex-col gap-6">
          <Frame label="AccountabilityBand">
            <AccountabilityBand {...NGO.accountability} />
          </Frame>
          <Frame label="AboutIntro">
            <AboutIntro {...NGO.about} />
          </Frame>
          <Frame label="FeatureBanner">
            <FeatureBanner {...NGO.about} />
          </Frame>
          <Frame label="ImpactStats · four, highlighted">
            <ImpactStats {...NGO.overallStats} />
          </Frame>
          <Frame label="ImpactStats · three, on paper">
            <ImpactStats {...NGO.overallStats} surface="paper" />
          </Frame>
          <Frame label="DonateWidget">
            <DonateWidget {...NGO.donate} />
          </Frame>
          <Frame label="CampaignHero">
            <CampaignHero {...NGO.campaign} />
          </Frame>
          <Frame label="CampaignHero · flip">
            <CampaignHero {...NGO.yemen} flip />
          </Frame>
          <Frame label="ActionCard">
            <ActionCard {...NGO.yemen} />
          </Frame>
          <Frame label="GetInvolved">
            <GetInvolved {...NGO.getInvolved} />
          </Frame>
          <Frame label="LegacyCollage">
            <LegacyCollage {...NGO.legacy} />
          </Frame>
          <Frame label="AppealSpotlight">
            <AppealSpotlight {...NGO.gaza} />
          </Frame>
          <Frame label="FightFor">
            <FightFor {...NGO.fightFor} />
          </Frame>
          <Frame label="ImpactMosaic">
            <ImpactMosaic {...NGO.mosaic} />
          </Frame>
        </div>
      </Section>

      <Section
        title="Zakat page sections"
        note="The pieces that stack into /giving (the Zakat page). The impact tabs there are GetInvolved with the CTA left off."
      >
        <div className="flex flex-col gap-6">
          <Frame label="PageHero">
            <PageHero {...ZAKAT.hero} />
          </Frame>
          <Frame label="FeatureGrid">
            <FeatureGrid {...ZAKAT.trust} />
          </Frame>
          <Frame label="ProjectGrid">
            <ProjectGrid {...ZAKAT.projects} />
          </Frame>
          <Frame label="NisabCallout">
            <NisabCallout {...ZAKAT.calc} />
          </Frame>
          <Frame label="Faq">
            <Faq {...ZAKAT.faq} />
          </Frame>
          <Frame label="Newsletter">
            <Newsletter {...ZAKAT.newsletter} />
          </Frame>
        </div>
      </Section>

      <Section
        title="Inner page sections"
        note="The pieces that stack into /get-involved/volunteer, /blogs and /contact-us."
      >
        <div className="flex flex-col gap-6">
          <Frame label="BannerHero">
            <BannerHero {...VOLUNTEER.hero} />
          </Frame>
          <Frame label="Prose">
            <Prose {...VOLUNTEER.purpose} />
          </Frame>
          <Frame label="SignupCard">
            <SignupCard {...VOLUNTEER.signup} />
          </Frame>
          <Frame label="Steps">
            <Steps {...VOLUNTEER.steps} />
          </Frame>
          <Frame label="Testimonials">
            <Testimonials {...VOLUNTEER.feedback} />
          </Frame>
          <Frame label="BlogGrid">
            <BlogGrid {...BLOGS} />
          </Frame>
          <Frame label="ContactDetails">
            <ContactDetails {...CONTACT.details} />
          </Frame>
          <Frame label="LinkCards">
            <LinkCards {...CONTACT.links} />
          </Frame>
          <Frame label="SplitFeature · flipped, with CTA">
            <SplitFeature {...GIFTS.feedback} />
          </Frame>
          <Frame label="OptionStrip · three, on mist">
            <OptionStrip {...GIFTS.water} />
          </Frame>
          <Frame label="OptionStrip · four, scrolls">
            <OptionStrip {...GIFTS.empowerment} />
          </Frame>
        </div>
      </Section>
    </Container>
  );
}
