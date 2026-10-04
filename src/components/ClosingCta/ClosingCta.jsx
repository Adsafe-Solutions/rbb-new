import CtaSection from "../CtaSection/CtaSection.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";

/* The page's last word before the footer — CtaSection with the props the
   pages have always passed: { heading, body?, ctas, image? }. With an
   image, the photograph hangs beside the ask as a tilted print; without,
   the ask is centred.

   `children` render under the buttons — the program pages put their
   links to the other program areas there. `tone` is the band: Sky Blue
   by default, because the footer under it is Deep Trust Blue; `paper`
   where the band above is already Sky Blue. */
export default function ClosingCta({ heading, body, ctas, image, tone = "accent", highlight, children }) {
  return (
    <CtaSection
      tone={tone}
      heading={heading}
      body={body}
      ctas={ctas}
      highlight={highlight}
      aside={image ? <EditorialImage image={image} tilt="r-lg" cast="cast-lg" /> : undefined}
    >
      {children}
    </CtaSection>
  );
}
