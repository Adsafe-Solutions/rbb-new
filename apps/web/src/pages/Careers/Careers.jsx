import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import FormSection from "../../components/FormSection/FormSection.jsx";
import { formState } from "../../lib/forms.js";
import useSeo from "../../hooks/useSeo.js";
import { routeMeta } from "../../content/seo.js";
import { CAREERS, alternativeContact, formConfig } from "../../content/index.js";

/* /about-us/careers — the Careers page, at the address the site already
   used (Document 08 keeps it rather than opening a second careers page).
   Deliberately not in the main navigation.

   Sections come from content/contact.js. "Why work with us" and "Open
   opportunities" say plainly that information is to come; "How to apply"
   and "Careers contact" are left out entirely until RBB defines them —
   shown as placeholders they would read as steps someone could take.
   Supplied roles render as a list under Open opportunities. No job, salary,
   benefit, location, requirement or deadline is invented.

   2026-10-13: a role with an application form saved in the admin
   (career-<role id>) gets that form, in its own section beneath the list,
   with a link to it from the role's line. A role without one shows its
   title only. */
export default function Careers() {
  useSeo(routeMeta(CAREERS.to));

  const applications = CAREERS.roles
    .map((role) => ({ role, config: role.id ? formConfig(`career-${role.id}`) : null }))
    .filter((a) => formState(a.config) === "ready");
  const open = new Set(applications.map((a) => a.role.id));

  const rows = CAREERS.sections
    .map((section) =>
      section.id === "opportunities" && CAREERS.roles.length
        ? { ...section, items: CAREERS.roles.map((role) => (open.has(role.id) ? `${role.title} — apply below` : role.title)) }
        : section
    )
    .filter((section) => section.body || section.items?.length || !section.hideWhenEmpty);

  return (
    <>
      <PageHeader title={CAREERS.title} parent={{ label: "About Us", to: "/about" }} kicker={CAREERS.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {CAREERS.body}
        </p>
      </PageHeader>

      <ContentRows rows={rows} />

      {applications.map(({ role, config }, i) => (
        <FormSection key={role.id} id={`apply-${role.id}`} kicker={role.title} config={config} alternative={alternativeContact()} tone={i % 2 ? "white" : "paper"} />
      ))}

      <ClosingCta tone="accent" {...CAREERS.closing} />
    </>
  );
}
