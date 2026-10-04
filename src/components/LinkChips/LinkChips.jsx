import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import LineIcon from "../LineIcon/LineIcon.jsx";

/* A row of sticker links, each with its icon — the "other pages like this
   one" under a closing call to action: the other three programs on a
   program page, the other three paths on a Get Involved page.

   A sticker: white, the 2px border of the band's ink, a small hard
   shadow; it steps up and out on hover. Items are { title, to, icon? };
   each is an ordinary link named by its title, the icon decoration.
   `align` is "center" or "start". (`surface` is accepted and ignored —
   the sticker takes its colours from the band.) */
export default function LinkChips({ items, align = "center", className = "" }) {
  return (
    <ul className={cx("flex flex-wrap gap-4", align === "start" ? "justify-start" : "justify-center", className)}>
      {items.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            data-tone="card"
            className={cx(
              "inline-flex items-center gap-2.5 rounded-full border-rim bg-paper-white px-5 py-3 font-bold text-fg cast-sm",
              "transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-bumble-honey hover:text-night",
              "motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
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
