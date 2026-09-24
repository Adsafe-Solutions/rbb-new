import { useId } from "react";
import { Link } from "react-router-dom";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The four program areas, as four equal cards on the Light Gray band.

   Each card is ONE link, stretched over the card by its `after:` box, and
   the link's own text is the visible "Explore Education". So a click
   anywhere on the card goes to the program page, a screen reader lists
   four links named for their programs rather than four "Learn more"s, and
   a voice user can say exactly what they see. The title is the card's
   <h3>, outside the link, so the heading outline stays clean.

   Icons, not photographs: the only photographs available are of relief
   distributions, and a picture of one under "Education" would claim an
   education project nobody has described. */
export default function ProgramAreas({ kicker, heading, items }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="bg-mist py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        <ul className="reveal mt-12 grid gap-cards sm:grid-cols-2 lg:grid-cols-4 md:mt-14">
          {items.map((item) => (
            <li
              key={item.to}
              className="group relative flex flex-col rounded-3xl rounded-tr-[3rem] bg-paper-white p-7 transition-shadow duration-300 hover:shadow-sm md:p-8"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bumble-honey/12 text-trust-blue transition-colors duration-300 group-hover:bg-bumble-honey group-hover:text-paper-white">
                <LineIcon name={item.icon} className="h-7 w-7" />
              </span>

              <h3 className="mt-7 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                {item.title}
              </h3>
              <p className="mt-3 flex-1 text-graphite">{item.description}</p>

              <Link
                to={item.to}
                className="mt-7 inline-flex items-center gap-2 self-start font-semibold text-trust-blue underline-offset-4 after:absolute after:inset-0 after:rounded-3xl group-hover:underline"
              >
                Explore {item.title}
                <LineIcon
                  name="arrow"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
