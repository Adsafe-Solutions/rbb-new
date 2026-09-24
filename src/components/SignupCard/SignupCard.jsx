import Container from "../Container/Container.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import { FORMS } from "../../content/index.js";

/* A sign-up prompt on a Light Gray card.

   ⚠ It used to hold a form that "confirmed in place" — thanked the visitor
   and sent nothing anywhere. A form with no destination tells someone they
   have signed up when they have not, so there is no form: the card says
   what the sign-up is for and states plainly (`pending`) that it is not
   available yet. The form goes back in through FormShell only once the
   newsletter config is ready (content/forms.js, Document 12). */
export default function SignupCard({ heading, body, pending, form = FORMS.newsletter }) {
  return (
    <section className="py-10 md:py-16">
      <Container>
        <div className="reveal mx-auto max-w-3xl rounded-3xl rounded-br-[5rem] bg-mist p-8 text-center md:p-14">
          <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
          {body && <p className="mt-4">{body}</p>}
          <FormShell
            config={form}
            className="mx-auto mt-8 max-w-lg text-left"
            fallback={
              pending && (
                <p className="mx-auto mt-8 max-w-lg rounded-2xl bg-paper-white px-6 py-4 font-medium text-bumble-ink">
                  {pending}
                </p>
              )
            }
          />
        </div>
      </Container>
    </section>
  );
}
