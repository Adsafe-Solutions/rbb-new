import { useId } from "react";
import { formState } from "../../lib/forms.js";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import FormShell from "../FormShell/FormShell.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { FORMS } from "../../content/index.js";

/* The newsletter: the ask on a Sky Blue band, a photograph pinned up
   beside it.

   ⚠ No form until there is somewhere real to send it. It used to have one
   that "confirmed in place" and sent the address nowhere. Until RBB
   approves a newsletter provider, privacy wording and data handling
   (Document 07), the band states that sign-up is not yet available
   (`pending`) instead. The form returns through FormShell — its inline
   layout, one field and a send button — only when the newsletter config
   is ready. Nothing is ever stored in the browser. */
export default function Newsletter({ kicker, heading, body, pending, src, alt, focal, form = FORMS.newsletter, tone = "accent" }) {
  const headingId = useId();
  /* No sign-up to offer and nothing to say instead: no section at all. */
  if (formState(form) !== "ready" && !pending) return null;

  return (
    <Section tone={tone} pad="lg" watermark="left" aria-labelledby={headingId}>
      <div className="grid items-center gap-14 lg:grid-cols-[7fr_5fr] lg:gap-20">
        <div>
          <SectionHeading id={headingId} kicker={kicker} heading={heading} intro={body} />
          <FormShell
            config={form}
            layout="inline"
            className="reveal mt-10 max-w-lg"
            fallback={
              pending && (
                <p className="type-note reveal mt-10 inline-block max-w-lg rounded-xl border-2 border-dashed border-edge px-5 py-4 text-fg">
                  {pending}
                </p>
              )
            }
          />
        </div>
        <div className="reveal mx-auto w-full max-w-md">
          <EditorialImage image={{ src, alt, focal }} tilt="r-lg" ratio="aspect-[4/3]" sizes="(min-width: 1024px) 34vw, 88vw" />
        </div>
      </div>
    </Section>
  );
}
