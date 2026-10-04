import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import StepCard from "../../components/StepCard/StepCard.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import {
  POLICY_COPY,
  isFinalPolicy,
  isPublished,
  policyById,
  policyByRoute,
  policyContact,
} from "../../content/index.js";

/* /privacy and /terms — one template, filled from the
   policy's record in content/policies.js (Document 13):

     pending    paper  PageHeader  the title
                white  EmptyPanel  the neutral pending line
     published  paper  PageHeader  title and RBB's own dates
                white  a sticky contents rail + the sections as numbered
                       sheets, as supplied
                           the verified contact, if the policy names one
                           links to the other PUBLISHED policies

   ⚠ A policy that is not published renders NO policy text — no draft
   sections, no outline headings, no date. Headings with nothing under
   them would read as a policy that exists. */

/* "2026-03-01" → "March 1, 2026". Parsed as UTC so the date never slips a
   day in a western time zone. */
const formatDate = (iso) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );

export default function Policy() {
  const { pathname } = useLocation();
  const policy = policyByRoute(pathname);
  const t = POLICY_COPY;

  /* Pending — or published but still WORKING text (isFinalPolicy): the
     demo Privacy and Terms text is never shown as if it were RBB's
     policy. The page keeps its route and its links; it shows the neutral
     pending line, and content/seo.js keeps it out of the index. */
  if (!isFinalPolicy(policy)) {
    return (
      <>
        <PageHeader title={policy.title} kicker={t.kicker} />
        <Section tone="white" pad="lg" aria-label={policy.title}>
          <EmptyPanel text={policy.pending} className="reveal" />
        </Section>
      </>
    );
  }

  const contact = policyContact(policy);
  const related = (policy.relatedPolicies ?? []).map(policyById).filter(isPublished);
  const dates = [
    policy.effectiveDate && [t.effective, policy.effectiveDate],
    policy.lastUpdated && [t.updated, policy.lastUpdated],
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={policy.title} kicker={t.kicker}>
        {dates.length > 0 && (
          <dl className="type-meta mt-8 flex flex-wrap gap-x-8 gap-y-2 text-quiet">
            {dates.map(([label, iso]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-fg">{label}</dt>
                <dd>
                  <time dateTime={iso}>{formatDate(iso)}</time>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      <Section tone="white" pad="lg">
        <div className="grid gap-12 lg:grid-cols-[3fr_8fr] lg:gap-16">
          <nav aria-label={t.contents} className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <p className="type-meta text-fg">{t.contents}</p>
            <ol className="mt-5 grid gap-1 border-l-2 border-edge">
              {policy.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-0.5 flex gap-3 border-l-2 border-transparent py-1.5 pl-4 text-fg transition-colors hover:border-bumble-honey">
                    <span aria-hidden="true" className="type-meta pt-0.5 text-quiet">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="underline-offset-4 hover:underline">{s.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* The policy as a stack of numbered sheets — the clauses of a
              document, each on its own page — square to the page and at a
              reading measure: this is text people read closely. */}
          <article className="min-w-0 max-w-[46rem]">
            {policy.intro?.map((text) => (
              <p key={text} className="type-lead mt-4 border-l-4 border-pop pl-5 text-copy first:mt-0">
                {text}
              </p>
            ))}

            <div className="mt-10 grid gap-8">
              {policy.sections.map((s, i) => (
                <StepCard
                  key={s.id}
                  as="section"
                  number={i + 1}
                  id={s.id}
                  aria-labelledby={`${s.id}-heading`}
                  title={s.heading}
                  headingAs="h2"
                  headingId={`${s.id}-heading`}
                  cast="sm"
                  className="scroll-mt-[calc(var(--header-h)+1rem)]"
                >
                  {(s.body ?? []).map((text) => (
                    <p key={text} className="mt-4 leading-relaxed text-copy first:mt-0">
                      {text}
                    </p>
                  ))}
                  {s.items?.length > 0 && (
                    <ul className="mt-4 list-disc space-y-2 pl-6 text-copy marker:text-trust-blue">
                      {s.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </StepCard>
              ))}
            </div>

            {contact && (
              <section aria-labelledby="policy-contact" data-tone="ink" className="mt-12 rounded-2xl p-6 sm:p-8">
                <h2 id="policy-contact" className="type-meta">
                  {t.contact}
                </h2>
                <p className="mt-3 text-[20px] font-extrabold">
                  {contact.href ? (
                    <a href={contact.href} className="break-words text-fg underline decoration-bumble-honey decoration-[3px] underline-offset-4">
                      {contact.value}
                    </a>
                  ) : (
                    contact.value
                  )}
                </p>
              </section>
            )}

            {related.length > 0 && (
              <nav aria-label={t.related} className="mt-12 border-t-2 border-edge pt-8">
                <p className="type-meta text-fg">{t.related}</p>
                <LinkChips className="mt-5" align="start" items={related.map((p) => ({ title: p.title, to: p.route }))} />
              </nav>
            )}
          </article>
        </div>
      </Section>
    </>
  );
}
