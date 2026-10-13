/* The brand's own details. Every component reads the name from here rather
   than hard-coding it, so a rename is one edit — including the oversized
   hero mark, which renders whatever string this gives it.

   2026-10-13: the CMS's (Admin → Settings → General: short name, full
   name, summary): the published snapshot sets them. Empty without one.
     name       the everyday mark (the header, copy, the copyright line,
                the footer's oversized wordmark)
     fullName   for the places that spell it out — page metadata and the
                accessible name of every link home
     summary    the one-line description (the footer, page metadata) */
export const BRAND = {
  name: "",
  fullName: "",
  summary: "",
};

export default BRAND;
