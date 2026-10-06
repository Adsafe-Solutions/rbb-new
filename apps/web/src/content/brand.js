/* The brand's own details. Every component reads the name from here rather
   than hard-coding it, so a rename is one edit — including the oversized
   hero mark, which renders whatever string this gives it. */
export const BRAND = {
  name: "RBB",
  /* The name RBB stands for. The short form stays the everyday mark (the
     header, copy, the copyright line, the footer's oversized wordmark);
     the full name is for the places that spell it out — page metadata and
     the accessible name of every link home. */
  fullName: "Rising Beyond Borders",
  /* The one description the supplied annual report confirms (Document 01,
     "Organizational basis"). Used by the footer, the page metadata and
     the "who we are" block. The tagline and description this file used
     to carry — "since 1993", "15+ countries" — are not in the supplied
     materials and were removed rather than left for something to pick
     up. */
  summary:
    "A non-profit focused on empowering communities and creating sustainable solutions.",
};

export default BRAND;
