import { useId } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { glideTo } from "../../animations/lenis.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import DonationForm from "../DonationForm/DonationForm.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import Faq from "../Faq/Faq.jsx";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";
import TrustPanel from "../TrustPanel/TrustPanel.jsx";
import { DONATION } from "../../content/index.js";

/* THE donation page — one composition for every page whose purpose is a
   gift: the general donation page, each emergency appeal, each campaign,
   and any future project page. CONTENT + CONTEXT change; the form never
   does (components/DonationForm, configured by DONATION.form).

   `experience` is built in content/donation.js — `generalDonation()`,
   `appealDonation(appeal)` — in one shape (documented there).

         paper   01 Hero + context + FORM   what you are supporting, why,
                                            a photograph — the form beside
                                            it on desktop, right under it
                                            on a phone
         white   Why it matters            the story, as a statement
         paper   How your support helps    numbered areas, never costed
         —       children                  page-specific bands (the appeal
                                            lists on /appeals)
         ink     Trust                     transparency
         white   FAQ                       only with approved answers
         accent  Closing                   back to the form — not a
                                            second form

   Every optional block (`why`, `impact`, `trust`, `faq`, `children`) is
   simply left out when it has no content — never an empty or "to be
   provided" band. Section numbers count what is on the page.

   The FORM is early on purpose: on desktop it is in the first screen
   beside the context; on a phone it follows the short context directly.
   It is a white card, square and calm — no tilt or poster decoration
   around a payment action. */
export default function DonationExperience({ experience, children }) {
  const formId = `${experience.id}-form`;
  const { why, impact, trust, faq = [], closing } = experience;
  let n = 0;
  const next = () => ++n;

  /* "Donate" at the foot of the page: back to the ONE form, and focus on
     its heading so a keyboard or screen-reader user is told where they are. */
  const toForm = () => {
    const target = document.getElementById(experience.id);
    if (target) glideTo(target);
    document.getElementById(`${formId}-heading`)?.focus({ preventScroll: true });
  };

  return (
    <>
      <DonationHero experience={experience} formId={formId} />

      {why?.body?.length > 0 && <Why index={next()} {...why} />}

      {impact?.items?.length > 0 && <Impact index={next()} {...impact} />}

      {children}

      {trust && <TrustPanel tone="ink" {...trust} />}

      {faq.length > 0 && <Faq index={next()} tone="white" kicker={DONATION.faq.kicker} heading={DONATION.faq.heading} items={faq} />}

      {closing && (
        <Section tone="accent" pad="lg" watermark="right">
          <div className="reveal mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="type-title">{closing.heading}</h2>
            <Button size="lg" variant="ink" onClick={toForm} className="mt-9">
              {closing.cta}
            </Button>
          </div>
        </Section>
      )}
    </>
  );
}

/* 01 — the hero, the context and the form, in one band so the form is in
   the first screen on desktop. Pulled up under the fixed header like
   every page's first band. The text column is sticky beside the taller
   form on desktop. Motion is CSS at first paint (`data-enter-*`), as on
   every first screen. */
function DonationHero({ experience, formId }) {
  const { eyebrow, title, description, image, parent, context, donation, releaseMarker } = experience;

  return (
    <section data-tone="paper" className="relative -mt-[var(--header-h)] overflow-clip pt-[var(--header-h)]">
      <Mark className="pointer-events-none absolute -right-[14%] top-[2%] h-[min(90vw,44rem)] w-[min(90vw,44rem)] rotate-[8deg] text-fg opacity-[0.05]" />
      <Container className="relative pb-16 pt-10 md:pb-24 md:pt-14">
        {releaseMarker && <span hidden data-release-marker={releaseMarker} />}
        <nav aria-label="Breadcrumb">
          <ol className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-quiet">
            <Crumb to="/">Home</Crumb>
            {parent && <Crumb to={parent.to}>{parent.label}</Crumb>}
            <li aria-current="page" className="text-fg">
              {title}
            </li>
          </ol>
        </nav>

        <div className="mt-10 grid gap-12 lg:grid-cols-[6fr_5fr] lg:gap-14 xl:gap-20">
          <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
            {eyebrow && <SectionKicker data-enter-item>{eyebrow}</SectionKicker>}
            {/* Title size, not billboard: strong, but the form beside it
                stays the thing to act on. */}
            <h1 data-enter-text style={{ "--enter-i": 1 }} className="type-title mt-5 hyphens-auto">
              {title}
            </h1>
            {description && (
              <p data-enter-text style={{ "--enter-i": 1 }} className="type-lead mt-6 max-w-[46ch] text-copy">
                {description}
              </p>
            )}
            {image && (
              <div data-enter-item style={{ "--enter-i": 2 }} className="mt-10 max-w-xl">
                <EditorialImage image={image} ratio="aspect-[16/10]" tilt="l" priority sizes="(min-width: 1024px) 42vw, 92vw" />
              </div>
            )}
            {context?.body?.length > 0 && (
              <div data-enter-item style={{ "--enter-i": 3 }} className="mt-10 max-w-[52ch] border-l-[6px] border-pop pl-6">
                {context.label && <p className="type-meta text-quiet">{context.label}</p>}
                {context.body.map((text) => (
                  <p key={text} className="mt-2 text-[17px] leading-relaxed text-copy">
                    {text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* The one form. `id` is the page's #donate anchor; the scroll
              margin keeps its top clear of the fixed header. */}
          <div id={experience.id} className="mx-auto w-full min-w-0 max-w-xl scroll-mt-[calc(var(--header-h)+1rem)] lg:mx-0">
            <DonationForm config={DONATION.form.config} copy={DONATION.form.copy} donation={donation} formId={formId} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function Crumb({ to, children }) {
  return (
    <li className="flex items-center gap-2">
      <Link to={to} className="underline-offset-4 transition-colors hover:text-fg hover:underline">
        {children}
      </Link>
      <span aria-hidden="true">/</span>
    </li>
  );
}

/* Why it matters — the heading beside the statement, the first paragraph
   as a pull-quote. */
function Why({ id, index, kicker, heading, body, cta }) {
  const headingId = useId();
  return (
    <Section id={id} tone="white" pad="lg" aria-labelledby={headingId}>
      <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
        <div data-anim="sequence" className="lg:pt-12">
          {body.map((text, i) => (
            <p
              key={text}
              data-anim-item
              data-anim="soft"
              className={
                i === 0
                  ? "border-l-[6px] border-pop pl-6 text-[clamp(1.375rem,2.2vw,1.75rem)] font-bold leading-snug text-fg"
                  : "mt-6 max-w-[58ch] text-[19px] leading-relaxed text-copy"
              }
            >
              {text}
            </p>
          ))}
          {cta && (
            <div data-anim-item data-anim="soft">
              <Button to={cta.to} variant="outline" className="mt-9">
                {cta.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

/* How your support helps — numbered areas as cards, square: they are read
   and compared. General areas only; never a costed claim. */
function Impact({ id, index, kicker, heading, intro, items }) {
  const headingId = useId();
  return (
    <Section id={id} tone="paper" pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} intro={intro} />
      <ol data-anim-stagger className={cx("gap-cards mt-14 grid sm:grid-cols-2", items.length >= 4 && "lg:grid-cols-4", items.length === 3 && "lg:grid-cols-3")}>
        {items.map((item, i) => (
          <li key={item.title}>
            <OffsetCard pad="md" className="h-full">
              <p aria-hidden="true" className="type-meta text-quiet">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="type-card mt-4">{item.title}</h3>
              {item.description && <p className="mt-3 text-copy">{item.description}</p>}
            </OffsetCard>
          </li>
        ))}
      </ol>
    </Section>
  );
}
