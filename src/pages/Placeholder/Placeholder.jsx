import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import SectionLinks from "../../components/SectionLinks/SectionLinks.jsx";
import useSeo from "../../hooks/useSeo.js";
import { routeMeta } from "../../content/seo.js";
import { SITE } from "../../content/index.js";

/* Every page in the sitemap that has no content yet, and every older
   link that still points at a page nobody has built.

   A sitemap page arrives with `page` — its entry from content/nav.js —
   so it has a real title, a breadcrumb back to its section, and, if it
   IS a section, cards for the pages inside it. That makes this the
   section landing page as well as the stub: a hub is its intro plus its
   children, and the children are already known.

   The copy says what is true — the content has not been supplied yet —
   rather than filling the space with something that reads like fact.
   Later phases replace these routes one at a time with real pages. */
export default function Placeholder({ page }) {
  const { pathname } = useLocation();

  /* An older stub knows nothing but its path, so the path is its title:
     "/giving/build-a-well" → "Build a well". */
  const title =
    page?.title ??
    page?.label ??
    pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, " ")
      .replace(/^./, (c) => c.toUpperCase());

  /* Never indexed: a page with nothing on it yet (content/seo.js). */
  useSeo(routeMeta(pathname, { title }));

  return (
    <>
      <PageHeader title={title} parent={page?.parent}>
        <p className="mt-4 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {SITE.placeholder}
        </p>
      </PageHeader>

      {page?.children && (
        <SectionLinks heading={SITE.sectionHeading} items={page.children} />
      )}
    </>
  );
}
