import { useId } from "react";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Container from "../../components/Container/Container.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import TeamGrid from "../../components/TeamGrid/TeamGrid.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import {
  TEAM_COPY,
  TEAM_GOVERNANCE,
  TEAM_GROUPS,
  approvedMembers,
  memberCard,
  membersIn,
} from "../../content/index.js";

/* /about/team — Our Team & Organization (Document 10):

     01  mist band  PageHeader        the page's one line
     02  white      ContentRows       the team and the mission
     03  white      TeamGrid ×N       one per TEAM_GROUPS group with approved
                                      people — or, with nobody approved, the
                                      one plain empty statement
     06  white      governance note   only once RBB approves one
     07  white      InvolvementPaths  Volunteer · Partner With Us
     08  mist band  ClosingCta

   Everything comes from content/team.js and only APPROVED people render.

   ⚠ The empty state here is TEXT, deliberately — not TeamGrid's row of
   empty portrait frames (used on /about). On a page whose subject is the
   people, blank frames read as placeholder people, which Document 10
   rules out. */
export default function Team() {
  useReveal();
  const t = TEAM_COPY;
  const emptyId = useId();
  const govId = useId();
  const anyone = approvedMembers().length > 0;
  const governance = TEAM_GOVERNANCE.status === "approved" && TEAM_GOVERNANCE.body;

  return (
    <>
      <PageHeader title={t.heading} parent={{ label: "About Us", to: "/about" }} kicker={t.kicker}>
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {t.body}
        </p>
      </PageHeader>

      <ContentRows rows={[t.intro]} />

      {anyone ? (
        TEAM_GROUPS.map((group) => {
          const members = membersIn(group.id);
          return members.length > 0 ? (
            <TeamGrid
              key={group.id}
              id={group.id}
              kicker={group.kicker}
              heading={group.heading}
              members={members.map(memberCard)}
            />
          ) : null;
        })
      ) : (
        <section aria-labelledby={emptyId} className="pb-20 md:pb-28">
          <Container>
            <SectionHeading id={emptyId} {...t.emptySection} className="reveal" />
            <EmptyPanel text={t.empty} className="reveal mt-10" />
          </Container>
        </section>
      )}

      {governance && (
        <section aria-labelledby={govId} className="pb-20 md:pb-28">
          <Container>
            <SectionHeading id={govId} heading={t.governance.heading} className="reveal" />
            <p className="reveal mt-5 max-w-prose text-graphite">{TEAM_GOVERNANCE.body}</p>
            <Button variant="outline" to={t.governance.cta.to} className="reveal mt-8">
              {t.governance.cta.label}
            </Button>
          </Container>
        </section>
      )}

      <InvolvementPaths {...t.getInvolved} />

      <ClosingCta {...t.closing} />
    </>
  );
}
