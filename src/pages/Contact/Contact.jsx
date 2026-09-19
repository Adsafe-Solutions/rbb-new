import ContactDetails from "../../components/ContactDetails/ContactDetails.jsx";
import LinkCards from "../../components/LinkCards/LinkCards.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { CONTACT } from "../../content/index.js";

/* /contact-us, in the order the reference stacks it. */
export default function Contact() {
  useReveal();

  return (
    <>
      <ContactDetails {...CONTACT.details} />
      <LinkCards {...CONTACT.links} />
      <Newsletter {...CONTACT.newsletter} />
    </>
  );
}
