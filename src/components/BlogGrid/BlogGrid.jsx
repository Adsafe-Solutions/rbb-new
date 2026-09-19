import { useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The blog index: a search box that filters the list as you type, a grid
   of photo cards, and previous/next paging.

   Filtering and paging are client-side over the content array — there is
   no CMS yet, so the whole list is in content/blogs.js and this is the
   entire backend. */

const PAGE_SIZE = 9;

export default function BlogGrid({ heading, items, searchPlaceholder = "Search" }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter((b) => (b.title + " " + b.excerpt).toLowerCase().includes(q))
    : items;
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = matches.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="reveal flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg md:text-[length:clamp(3.5rem,5vw,4.5rem)]">
            {heading}
          </h1>
          <label className="w-full md:max-w-sm">
            <span className="sr-only">{searchPlaceholder}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-mist bg-paper-white px-5 py-4 outline-none focus:border-bumble-ink"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="mt-14 text-graphite">Nothing matches “{query}”.</p>
        ) : (
          <ul className="reveal mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <li key={post.slug} className="group flex flex-col">
                <Link to={`/blogs/${post.slug}`} className="flex flex-1 flex-col">
                  <div className="aspect-[3/2] overflow-hidden rounded-3xl">
                    <img
                      src={post.src}
                      alt={post.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h2 className="mt-5 font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm group-hover:underline underline-offset-4">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-graphite">{post.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-4">
            {[
              ["Previous", -1],
              ["Next", 1],
            ].map(([label, dir]) => {
              const target = current + dir;
              const disabled = target < 0 || target >= pages;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPage(target)}
                  className={cx(
                    "rounded-2xl px-6 py-3 font-medium transition-colors",
                    disabled ? "bg-mist text-graphite" : "bg-bumble-ink text-paper-white hover:bg-charcoal"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        )}
      </Container>
    </section>
  );
}
