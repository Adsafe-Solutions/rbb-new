import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";

/* A row of filter chips — /media/events by program, /media/blogs by
   category. Each chip is a LINK to the same page with a query (`?program=`
   or `?category=`), never a button holding hidden state: the filtered
   list has an address, Back undoes it, and it works before hydration.

   Items are { id, label, to }; `current` is the selected id (null for
   "all"). The selected chip is the solid accent AND says so to a screen
   reader (`aria-current`), so it is never marked by colour alone. */
export default function FilterChips({ label, items, current, className = "" }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2.5">
        {items.map((item) => {
          const selected = (current ?? null) === (item.id ?? null);
          return (
            <li key={item.id ?? "all"}>
              <Link
                to={item.to}
                aria-current={selected ? "true" : undefined}
                className={cx(
                  "type-meta inline-flex min-h-11 items-center rounded-xl border-2 px-4 transition-colors",
                  selected ? "border-edge bg-pop text-on-pop" : "border-edge bg-transparent text-fg hover:bg-flip hover:text-on-flip"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
