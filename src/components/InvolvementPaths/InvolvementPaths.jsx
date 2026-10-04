import GetInvolved from "../GetInvolved/GetInvolved.jsx";

/* The ways to take part, as action boxes — the same section the homepage
   closes on (GetInvolved), at title size rather than billboard: on an
   inner page it is a way on, not the point of the page.

   Items are { title, description, cta, to, icon } (content/getInvolved.js
   `pathCards`). Removing an entry reflows the grid. */
export default function InvolvementPaths({ id, index, kicker, heading, items, tone = "white" }) {
  return <GetInvolved id={id} index={index} kicker={kicker} heading={heading} items={items} tone={tone} size="title" />;
}
