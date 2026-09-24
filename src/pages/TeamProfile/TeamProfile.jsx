import { Link, useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { memberMeta, notFoundMeta } from "../../content/seo.js";
import useReveal from "../../hooks/useReveal.js";
import { TEAM_COPY, hasProfile, memberBySlug } from "../../content/index.js";
import Picture from "../../components/Picture/Picture.jsx";

/* /about/team/:slug — one person's profile (Document 10's optional
   individual profile).

   Enabled only for an APPROVED person WITH a full approved biography:
   anyone else — unknown, draft, pending, or approved with only a card's
   worth of detail — is the ordinary 404. There is no profile page padded
   out with filler to look complete. Every other field renders only if
   present. */
function Profile({ member }) {
  useReveal();
  const t = TEAM_COPY.profile;

  return (
    <>
      <PageHeader
        title={member.name}
        parent={{ label: t.back, to: "/about/team" }}
        kicker={member.role}
        aside={
          member.image && (
            <div className="reveal aspect-[4/5] overflow-hidden rounded-3xl rounded-tr-[6rem] lg:max-w-sm lg:justify-self-end">
              <Picture sizes="(min-width: 1024px) 24rem, 90vw" src={member.image} alt={member.imageAlt ?? ""} className="h-full w-full object-cover" />
            </div>
          )
        }
      >
        {(member.departmentOrArea || member.location) && (
          <p className="mt-5 text-graphite">
            {[member.departmentOrArea, member.location].filter(Boolean).join(" · ")}
          </p>
        )}
      </PageHeader>

      <article className="py-16 md:py-24">
        <Container>
          <div className="reveal mx-auto max-w-[68ch]">
            {member.biography.map((paragraph) => (
              <p key={paragraph} className="mt-6 leading-[1.7] first:mt-0">
                {paragraph}
              </p>
            ))}

            {member.relatedLinks?.length > 0 && (
              <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
                <span className="font-semibold text-bumble-ink">{t.links}:</span>
                {member.relatedLinks.map((l) => (
                  <Link key={l.to} to={l.to} className="font-semibold text-trust-blue underline underline-offset-4">
                    {l.label}
                  </Link>
                ))}
              </p>
            )}

            {member.socialLinks?.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <span className="font-semibold text-bumble-ink">{t.social}:</span>
                {member.socialLinks.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trust-blue underline underline-offset-4">
                    {l.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </p>
            )}
          </div>
        </Container>
      </article>

      <ClosingCta {...TEAM_COPY.closing} />
    </>
  );
}

export default function TeamProfile() {
  const { slug } = useParams();
  const member = memberBySlug(slug);
  const show = member && hasProfile(member);
  useSeo(show ? memberMeta(member) : notFoundMeta());

  return show ? <Profile member={member} /> : <NotFound />;
}
