import { Link, useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import useReveal from "../../hooks/useReveal.js";
import {
  POLICY_COPY,
  isPublished,
  policyById,
  policyByRoute,
  policyContact,
} from "../../content/index.js";

/* /privacy, /terms, /accessibility — one template, filled from the
   policy's record in content/policies.js (Document 13):

     pending    mist band  PageHeader  the title
                white      EmptyPanel  the neutral pending line
     published  mist band  PageHeader  title and RBB's own dates
                white      contents + the sections, as supplied
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
  useReveal();
  const { pathname } = useLocation();
  const policy = policyByRoute(pathname);
  const t = POLICY_COPY;

  if (!isPublished(policy)) {
    return (
      <>
        <PageHeader title={policy.title} kicker={t.kicker} />
        <section aria-label={policy.title} className="py-20 md:py-28">
          <Container>
            <EmptyPanel text={policy.pending} className="reveal" />
          </Container>
        </section>
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
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-graphite">
            {dates.map(([label, iso]) => (
              <div key={label} className="flex gap-2">
                <dt className="font-semibold text-bumble-ink">{label}</dt>
                <dd>
                  <time dateTime={iso}>{formatDate(iso)}</time>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      <Container className="grid gap-12 py-20 md:py-28 lg:grid-cols-[3fr_8fr] lg:gap-16">
        <nav aria-label={t.contents} className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          <p className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
            {t.contents}
          </p>
          <ol className="mt-4 grid gap-2">
            {policy.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-trust-blue underline-offset-4 hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-prose">
          {policy.intro?.map((text) => (
            <p key={text} className="mt-4 text-[length:var(--text-subheading)] leading-subheading tracking-subheading first:mt-0">
              {text}
            </p>
          ))}

          {policy.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="mt-12 scroll-mt-[var(--header-h)] first:mt-0">
              <h2
                id={`${s.id}-heading`}
                className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm"
              >
                {s.heading}
              </h2>
              {(s.body ?? []).map((text) => (
                <p key={text} className="mt-4">
                  {text}
                </p>
              ))}
              {s.items?.length > 0 && (
                <ul className="mt-4 list-disc space-y-2 pl-6">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {contact && (
            <section aria-labelledby="policy-contact" className="mt-12 rounded-3xl bg-mist p-6 sm:p-8">
              <h2 id="policy-contact" className="font-bold">
                {t.contact}
              </h2>
              <p className="mt-2">
                {contact.href ? (
                  <a href={contact.href} className="break-words font-semibold text-trust-blue underline underline-offset-4">
                    {contact.value}
                  </a>
                ) : (
                  contact.value
                )}
              </p>
            </section>
          )}

          {related.length > 0 && (
            <nav aria-label={t.related} className="mt-12 border-t border-mist pt-8">
              <p className="font-semibold">{t.related}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {related.map((p) => (
                  <li key={p.id}>
                    <Link to={p.route} className="text-trust-blue underline underline-offset-4">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </article>
      </Container>
    </>
  );
}
