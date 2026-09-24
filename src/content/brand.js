/* The brand's own details. Every component reads the name from here rather
   than hard-coding it, so a rename is one edit — including the oversized
   hero mark, which renders whatever string this gives it. */
export const BRAND = {
  name: "RBB",
  /* The name RBB stands for. The short form stays the everyday mark (the
     header, copy, the copyright line); the full name is for the places
     that have the room to say it — the footer's oversized wordmark. */
  fullName: "Rising Beyond Borders",
  /* The full name as the footer's lockup: the first word as large as the
     space allows, the rest small beside it. `rest` is lowercase in the
     STRING, not by CSS text-transform: the footer fits the row by
     measuring this exact text, and a transform would change the glyphs
     after the measurement was taken. */
  wordmark: { lead: "Rising", rest: "beyond borders" },
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
