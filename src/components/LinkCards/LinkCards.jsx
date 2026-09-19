import { Link } from "react-router-dom";
import Container from "../Container/Container.jsx";

/* A row of "where next" cards — photo, title, one line — each a link.
   Mist band so the white cards step forward without a shadow. */
export default function LinkCards({ heading, items }) {
  return (
    <section className="bg-mist py-20 md:py-28">
      <Container>
        {heading && (
          <h2 className="reveal font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
        )}
        <ul className="reveal mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.title}>
              <Link
                to={item.to}
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-paper-white"
              >
                <div className="aspect-[3/2] overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading group-hover:underline underline-offset-4">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-graphite">{item.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
