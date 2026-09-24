import { Link } from "react-router-dom";
import Container from "../Container/Container.jsx";

/* A grid of photograph cards, each a link to a project. The title sits
   on the photograph over a gradient, never a flat scrim — the design
   never puts a hard edge inside a photo. */
/* `empty` is what shows in place of the grid when there are no
   projects to link to yet. */
export default function ProjectGrid({ heading, items, empty }) {
  return (
    <section className="py-20 md:py-32">
      <Container>
        <h2 className="reveal text-center font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          {heading}
        </h2>

        {items.length > 0 ? (
          <ul className="reveal mt-14 grid gap-cards sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.title}>
                <Link
                  to={item.to}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-3xl shadow-sm"
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bumble-ink/70 to-transparent p-6 pt-16">
                    <h3 className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm text-paper-white">
                      {item.title}
                    </h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          empty && <p className="reveal mt-6 text-center text-graphite">{empty}</p>
        )}
      </Container>
    </section>
  );
}
