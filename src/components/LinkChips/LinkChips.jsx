import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import LineIcon from "../LineIcon/LineIcon.jsx";

/* A row of small pill links, each with its icon — the "other pages like
   this one" under a closing call to action: the other three programs on a
   program page, the other three paths on a Get Involved page.

   Items are { title, to, icon? }. Each is an ordinary link named by its
   title; the icon is decoration. `align` is "center" (under a centred
   closing heading) or "start". `surface` is the ground the chips sit on —
   "mist" gets white chips, "paper" gets Light Gray ones — so a chip never
   disappears into its section. */
export default function LinkChips({ items, align = "center", surface = "mist", className = "" }) {
  return (
    <ul
      className={cx(
        "flex flex-wrap gap-3",
        align === "start" ? "justify-start" : "justify-center",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            className={cx(
              "group inline-flex items-center gap-2.5 rounded-full px-5 py-3 font-medium text-trust-blue transition-colors hover:bg-bumble-honey/15",
              surface === "paper" ? "bg-mist" : "bg-paper-white"
            )}
          >
            {item.icon && <LineIcon name={item.icon} className="h-5 w-5" />}
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
