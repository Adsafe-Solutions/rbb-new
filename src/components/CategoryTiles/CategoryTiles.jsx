import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A set of content types as tiles — /stories' "Browse by type".

   Items are { id, label, description, count, to }. A tile is a LINK only
   when its type has something in it; with nothing, it is plain text
   saying so (`noneLabel`) on a flat, dashed, unshadowed sheet — visibly
   not a control. `countLabel(n)` words the count ("3 stories").
   Document 07: no filter controls that lead to empty results.

   `current` marks the type being shown — in words (`currentLabel`) and on
   the accent, never by colour alone. */
export default function CategoryTiles({ items, noneLabel, countLabel, current, currentLabel, className = "" }) {
  return (
    <ul className={cx("grid gap-8 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => {
        const active = item.count > 0;
        const selected = current === item.id;
        const status = selected ? currentLabel : active ? countLabel(item.count) : noneLabel;

        if (!active) {
          return (
            <li key={item.id}>
              <div className="h-full rounded-2xl border-2 border-dashed border-hair p-6">
                <p className="type-card text-quiet">{item.label}</p>
                <p className="mt-2 text-quiet">{item.description}</p>
                <p className="type-meta mt-5 text-quiet">{status}</p>
              </div>
            </li>
          );
        }

        return (
          <li key={item.id}>
            <OffsetCard tone={selected ? "accent" : "card"} lift pad="sm" className="group h-full">
              <Link
                to={item.to}
                aria-current={selected ? "true" : undefined}
                className="type-card block after:absolute after:inset-0 after:rounded-2xl"
              >
                {item.label}
              </Link>
              <p className="mt-2 text-copy">{item.description}</p>
              <p className="type-meta mt-5 text-fg">{status}</p>
            </OffsetCard>
          </li>
        );
      })}
    </ul>
  );
}
