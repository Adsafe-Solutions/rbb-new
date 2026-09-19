/* The brand's own details. Every component reads the name from here rather
   than hard-coding it, so a rename is one edit — including the oversized
   hero mark, which renders whatever string this gives it. */
export const BRAND = {
  name: "RBB",
  /* Faith-neutral by design. RBB serves and is supported by people of
     every faith and none, so the line the whole site hangs off cannot name
     one tradition. Zakat and Sadaqah are still offered — as one route on
     /giving, alongside the others — but they are not the premise. */
  tagline: "Delivering aid where it is needed most, since 1993",

  /* Kept short: the mark is doing the talking. */
  description: "Humanitarian aid across 15+ countries — emergency relief, clean water, healthcare, education and orphan support.",
};

export default BRAND;
