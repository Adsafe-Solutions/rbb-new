import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import QuestionsPanel from "../../components/QuestionsPanel/QuestionsPanel.jsx";
import FormSection from "../../components/FormSection/FormSection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import { FORMS, GET_INVOLVED, GET_INVOLVED_PAGES, alternativeContact, pathByPath } from "../../content/index.js";

/* One page template for the ways to take part — Volunteer, Partner With
   Us, Fundraise (Document 06) — filled from the path's entry in
   content/getInvolved.js. Donate has its own page since Document 11
   (pages/Donate), because it has a state the others do not.

         paper  PageHeader      the path's name and line, its icon poster
         white  ContentRows     the path's sections, numbered, in its order
         paper  FormSection     the path's inquiry form, printed on a sheet
                                with numbered fields — ONLY once it is
                                ready (content/forms.js); until then
                                nothing renders here
         ink    Faq             only once RBB supplies answers
         white  QuestionsPanel  the contact route, or its pending state
         accent ClosingCta      the other three paths

   A section with no content shows its placeholder — except the ones
   marked `hideWhenEmpty` (how to apply, inquiries, start a fundraiser),
   which are left out until a real process exists: a placeholder there
   reads as a step someone could take.

   ⚠ Nothing on these pages collects details until the path's form has a
   verified destination. No form is ever drawn in a disabled state. */
export default function InvolvePath() {
  const { pathname } = useLocation();
  const path = pathByPath(pathname);
  const t = GET_INVOLVED_PAGES.path;
  const others = GET_INVOLVED.paths.filter((p) => p.to !== path.to);

  const hasContent = (s) => Boolean(s.body || s.items?.length || s.faqs?.length);
  const faqSection = path.sections.find((s) => s.faqs?.length);
  const rows = path.sections.filter((s) => s !== faqSection && (hasContent(s) || !s.hideWhenEmpty));

  return (
    <>
      <PageHeader
        title={path.title}
        parent={{ label: "Get Involved", to: "/get-involved" }}
        kicker={t.kicker}
        aside={<IconPanel icons={[path.icon]} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {path.shortDescription}
        </p>
      </PageHeader>

      <ContentRows rows={rows} />

      <FormSection id="inquiry" kicker={path.title} config={FORMS[path.id]} alternative={alternativeContact()} />

      {faqSection && (
        <Faq tone="ink" heading={faqSection.heading} items={faqSection.faqs} />
      )}

      <QuestionsPanel tone="white" {...t.questions} contact={GET_INVOLVED.contact} />

      <ClosingCta tone="accent" {...t.closing}>
        <LinkChips
          className="mt-10"
          items={others.map((p) => ({ title: p.title, to: p.to, icon: p.icon }))}
        />
      </ClosingCta>
    </>
  );
}
