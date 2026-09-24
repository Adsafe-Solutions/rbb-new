import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import QuestionsPanel from "../../components/QuestionsPanel/QuestionsPanel.jsx";
import FormSection from "../../components/FormSection/FormSection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import useReveal from "../../hooks/useReveal.js";
import { FORMS, GET_INVOLVED, GET_INVOLVED_PAGES, alternativeContact, pathByPath } from "../../content/index.js";

/* One page template for the ways to take part — Volunteer, Partner With
   Us, Fundraise (Document 06) — filled from the path's entry in
   content/getInvolved.js. Donate has its own page since Document 11
   (pages/Donate), because it has a state the others do not.

     01  mist band  PageHeader      the path's name and line, its icon
     02  white      ContentRows     the path's sections, in its own order
         white      FormSection     the path's inquiry form — ONLY once it
                                    is ready (content/forms.js); until
                                    then nothing renders here
     03  mist band  Faq             only once RBB supplies answers
     04  white      QuestionsPanel  the contact route, or its pending state
     05  mist band  ClosingCta      the other three paths

   A section with no content shows its placeholder — except the ones
   marked `hideWhenEmpty` (how to apply, inquiries, start a fundraiser),
   which are left out until a real process exists: a placeholder there
   reads as a step someone could take.

   ⚠ Nothing on these pages collects details until the path's form has a
   verified destination. No form is ever drawn in a disabled state. */
export default function InvolvePath() {
  useReveal();
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
        aside={<IconPanel icons={[path.icon]} className="reveal" />}
      >
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {path.shortDescription}
        </p>
      </PageHeader>

      <ContentRows rows={rows} />

      <FormSection id="inquiry" kicker={path.title} config={FORMS[path.id]} alternative={alternativeContact()} />

      {faqSection && (
        <Faq heading={faqSection.heading} items={faqSection.faqs} />
      )}

      <QuestionsPanel {...t.questions} contact={GET_INVOLVED.contact} />

      <ClosingCta {...t.closing}>
        <LinkChips
          className="mt-10"
          items={others.map((p) => ({ title: p.title, to: p.to, icon: p.icon }))}
        />
      </ClosingCta>
    </>
  );
}
