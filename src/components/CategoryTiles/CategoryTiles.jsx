import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";

/* A set of content types as tiles — /stories' "Browse by type".

   Items are { label, description, count, to }. A tile is a LINK only when
   its type has something in it; with nothing, it is plain text saying so
   (`noneLabel`). `countLabel(n)` words the count ("3 stories").
   Document 07: no filter controls that lead to empty results — the
   architecture is ready, the controls appear with content.
   `current` marks the type being shown, in words as well as colour. */
export default function CategoryTiles({
  items,
  noneLabel,
  countLabel,
  current,
  currentLabel,
  className = "",
}) {
  return (
    <ul className={cx("grid gap-cards sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => {
        const active = item.count > 0;
        const selected = current === item.id;
        const body = (
          <>
            <span className="block font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-trust-blue underline-offset-4 group-hover:underline">
              {item.label}
            </span>
            <span className="mt-2 block text-graphite">{item.description}</span>
            <span className="mt-4 block text-[length:var(--text-caption)] font-semibold tracking-caption text-trust-blue">
              {selected ? currentLabel : active ? countLabel(item.count) : noneLabel}
            </span>
          </>
        );

        return (
          <li key={item.id}>
            {active ? (
              <Link
                to={item.to}
                aria-current={selected ? "true" : undefined}
                className={cx(
                  "group block h-full rounded-3xl p-7 transition-colors",
                  selected ? "bg-bumble-honey/15 ring-2 ring-inset ring-trust-blue" : "bg-mist hover:bg-bumble-honey/15"
                )}
              >
                {body}
              </Link>
            ) : (
              <div className="h-full rounded-3xl bg-mist p-7">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
