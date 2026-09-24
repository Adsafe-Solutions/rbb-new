/* Approved donation wording — Document 22 §11, §20. EVERY slot is empty
   until RBB supplies and approves its exact text; an empty slot is simply
   left out of the email. Nothing here may be written on RBB's behalf:

     purpose  what the donation supports ("approved purpose wording")
     receipt  receipt / tax wording, IF any applies — no tax-deductibility,
              80G, CRA or similar claim without RBB's approval
     refund   the refund policy line, for the refund email
     support  where a donor goes with a question (a verified route)

   Plain strings, one sentence or two each. They reach donor emails
   escaped, as text. */
export const DONATION_WORDING = {
  purpose: null,
  receipt: null,
  refund: null,
  support: null,
};
