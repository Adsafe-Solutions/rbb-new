import { cx } from "../../lib/cx.js";
import LineIcon from "../LineIcon/LineIcon.jsx";

/* A hero visual made of program icons, for pages with no approved
   photograph. One icon: set large on Deep Trust Blue — a program page.
   Several: a grid of tiles, one per program — the /work overview, where
   the picture IS the four areas.

   Decorative (`aria-hidden`): every icon here stands beside text that
   names it. `icons` are LineIcon names. */
export default function IconPanel({ icons, className = "" }) {
  const single = icons.length === 1;

  if (single) {
    return (
      <div
        aria-hidden="true"
        className={cx(
          "relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl rounded-tr-[6rem] bg-trust-blue text-paper-white lg:aspect-square",
          className
        )}
      >
        <span className="absolute -bottom-1/4 -left-1/4 h-3/4 w-3/4 rounded-full bg-bumble-honey/25" />
        <LineIcon name={icons[0]} className="relative h-2/5 w-2/5" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cx("grid grid-cols-2 gap-tiles", className)}>
      {icons.map((icon, i) => (
        <span
          key={icon}
          className={cx(
            "flex aspect-square items-center justify-center rounded-3xl",
            i === 0 && "rounded-tl-[4rem] bg-trust-blue text-paper-white",
            i === 1 && "bg-paper-white text-trust-blue",
            i === 2 && "bg-paper-white text-trust-blue",
            i === 3 && "rounded-br-[4rem] bg-bumble-honey/20 text-trust-blue"
          )}
        >
          <LineIcon name={icon} className="h-1/3 w-1/3" />
        </span>
      ))}
    </div>
  );
}
