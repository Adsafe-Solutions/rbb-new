import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContactMethods from "../../components/ContactMethods/ContactMethods.jsx";
import QuestionsPanel from "../../components/QuestionsPanel/QuestionsPanel.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import LinkSection from "../../components/LinkSection/LinkSection.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { CONTACT_COPY, FORMS, ORG_CONTACT, SITE, alternativeContact, pathCards, verifiedOnly } from "../../content/index.js";

/* /contact — Document 08:

     01  mist band  PageHeader        the invitation
     02  white      ContactMethods    verified channels only, or pending
     03  white      QuestionsPanel    general inquiries — a real route, the
                                      contact form once it is ready, or pending
     04  white      InvolvementPaths  Donate · Volunteer · Partner · Fundraise
     05  white      LinkSection       careers → /about-us/careers
     06  mist band  Newsletter        the newsletter card — its form once ready,
                                      the pending line until then
     07  white      TrustPanel        → Transparency
     08  mist band  ClosingCta        Our Work · Get Involved

   Everything about how to reach RBB comes from content/contact.js, the
   same source as the footer and the Get Involved pages.

   ⚠ No stock "contact us" photography. The page this replaced showed
   another charity's phone, address, mailboxes and hours, and a newsletter
   form that thanked people for signing up to nothing. The forms here
   (content/forms.js, Document 12) render only once each has a real,
   verified destination and RBB's own success and failure copy — until
   then the pending lines stay exactly as they are. */
export default function Contact() {
  const t = CONTACT_COPY;
  const inquiry = ORG_CONTACT.generalInquiry;
  /* With no verified channel the contact-details section is left out
     (ContactMethods), so the bands after it shift one step to keep
     neighbouring bands in different tones. */
  const hasMethods = verifiedOnly(ORG_CONTACT.methods).length > 0 || verifiedOnly(ORG_CONTACT.social).length > 0;
  const n = hasMethods ? 1 : 0;

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {t.body}
        </p>
      </PageHeader>

      <ContactMethods index={1} highlight="reach us" kicker={t.methods.kicker} heading={t.methods.heading} labels={t.methods} />

      <QuestionsPanel
        index={1 + n}
        tone={hasMethods ? "paper" : "white"}
        {...t.inquiry}
        intro={inquiry.description}
        contact={{
          label: inquiry.label,
          url: inquiry.status === "verified" ? inquiry.href : null,
          pending: ORG_CONTACT.inquiryPending,
        }}
        form={FORMS.contact}
        alternative={alternativeContact()}
      />

      <InvolvementPaths index={2 + n} tone={hasMethods ? "white" : "paper"} {...t.getInvolved} items={pathCards()} />

      <LinkSection index={3 + n} tone={hasMethods ? "paper" : "white"} {...t.careers} />

      <Newsletter
        kicker={t.newsletter.kicker}
        heading={t.newsletter.heading}
        pending={SITE.newsletterPending}
        src={t.newsletter.image.src}
        alt={t.newsletter.image.alt}
        focal={t.newsletter.image.focal}
        form={FORMS.newsletter}
      />

      {/* Paper, not the panel's default Deep Trust Blue: between the Sky
          Blue newsletter and the Sky Blue close, a blue band made the end
          of the page four alternating saturated stripes. */}
      <TrustPanel tone="paper" {...t.transparency} links={SITE.transparencyLinks} linkMeta={SITE.transparencyLinkMeta} />

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
