import { Link, useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { memberMeta, notFoundMeta } from "../../content/seo.js";
import { TEAM_COPY, hasProfile, memberBySlug } from "../../content/index.js";

/* /about/team/:slug — one person's profile (Document 10's optional
   individual profile).

   Enabled only for an APPROVED person WITH a full approved biography:
   anyone else — unknown, draft, pending, or approved with only a card's
   worth of detail — is the ordinary 404. There is no profile page padded
   out with filler to look complete. Every other field renders only if
   present. */
function Profile({ member }) {
  const t = TEAM_COPY.profile;

  return (
    <>
      <PageHeader
        title={member.name}
        parent={{ label: t.back, to: "/about/team" }}
        kicker={member.role}
        aside={
          member.image && (
            <EditorialImage
              image={{ src: member.image, alt: member.imageAlt ?? "" }}
              ratio="aspect-[4/5]"
              tilt="r-lg"
              cast="cast-lg"
              priority
              sizes="(min-width: 1024px) 24rem, 90vw"
              className="mx-auto max-w-sm"
            />
          )
        }
      >
        {(member.departmentOrArea || member.location) && (
          <p className="type-meta mt-8 text-quiet">
            {[member.departmentOrArea, member.location].filter(Boolean).join(" · ")}
          </p>
        )}
      </PageHeader>

      <Section as="article" tone="white" pad="lg">
          <div className="reveal mx-auto max-w-[68ch]">
            {/* The release marker, for HTML scans only (never shown). */}
            {member.releaseMarker && <span hidden data-release-marker={member.releaseMarker} />}
            {member.biography.map((paragraph) => (
              <p key={paragraph} className="mt-6 leading-[1.75] text-copy first:mt-0 first:type-lead">
                {paragraph}
              </p>
            ))}

            {member.relatedLinks?.length > 0 && (
              <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
                <span className="type-meta text-quiet">{t.links}:</span>
                {member.relatedLinks.map((l) => (
                  <Link key={l.to} to={l.to} className="font-bold text-fg underline decoration-2 underline-offset-4">
                    {l.label}
                  </Link>
                ))}
              </p>
            )}

            {member.socialLinks?.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <span className="type-meta text-quiet">{t.social}:</span>
                {member.socialLinks.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="font-bold text-fg underline decoration-2 underline-offset-4">
                    {l.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </p>
            )}
          </div>
      </Section>

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
