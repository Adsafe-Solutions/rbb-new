import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useSeo from "../../hooks/useSeo.js";
import { routeMeta } from "../../content/seo.js";
import { CAREERS } from "../../content/index.js";

/* /about-us/careers — the Careers page, at the address the site already
   used (Document 08 keeps it rather than opening a second careers page).
   Deliberately not in the main navigation.

   Sections come from content/contact.js. "Why work with us" and "Open
   opportunities" say plainly that information is to come; "How to apply"
   and "Careers contact" are left out entirely until RBB defines them —
   shown as placeholders they would read as steps someone could take.
   Supplied roles render as a list under Open opportunities. No job, salary,
   benefit, location, requirement or deadline is invented. */
export default function Careers() {
  useSeo(routeMeta(CAREERS.to));

  const rows = CAREERS.sections
    .map((section) =>
      section.id === "opportunities" && CAREERS.roles.length
        ? { ...section, items: CAREERS.roles.map((role) => role.title) }
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

      <ClosingCta tone="accent" {...CAREERS.closing} />
    </>
  );
}
