import { cx } from "../../lib/cx.js";
import LineIcon from "../LineIcon/LineIcon.jsx";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A hero visual made of the program icons, for pages with no approved
   photograph — set as printed objects rather than as an illustration.

   One icon: a single tilted poster on Deep Trust Blue, the icon large on
   a Sky Blue block, the mark bled off its corner — a program page. Several:
   a pinned-up cluster of tiles in the three inks, each leaning its own
   way — the /work overview, where the picture IS the four areas.

   Decorative (`aria-hidden`): every icon here stands beside text that
   names it. `icons` are LineIcon names. */
const TILES = [
  { tone: "ink", tilt: "l" },
  { tone: "card", tilt: "r" },
  { tone: "accent", tilt: "r" },
  { tone: "card", tilt: "l" },
];

export default function IconPanel({ icons, className = "" }) {
  if (icons.length === 1) {
    return (
      <div aria-hidden="true" className={cx("mx-auto w-full max-w-[12rem] sm:max-w-xs lg:max-w-md", className)}>
        <OffsetCard tone="ink" cast="lg" tilt="r-lg" pad="none" className="relative flex aspect-square items-center justify-center overflow-hidden">
          <Mark className="absolute -bottom-[18%] -left-[18%] h-[70%] w-[70%] -rotate-12 text-paper-white opacity-[0.08]" />
          <span className="relative flex h-[46%] w-[46%] -rotate-3 items-center justify-center rounded-2xl bg-pop text-on-pop">
            <LineIcon name={icons[0]} className="h-1/2 w-1/2" />
          </span>
        </OffsetCard>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cx("mx-auto grid w-full max-w-[14rem] grid-cols-2 gap-5 sm:max-w-xs lg:max-w-md lg:gap-6", className)}>
      {icons.map((icon, i) => {
        const tile = TILES[i % TILES.length];
        return (
          <OffsetCard
            key={icon}
            tone={tile.tone}
            tilt={tile.tilt}
            pad="none"
            className={cx("flex aspect-square items-center justify-center", i % 2 === 1 && "translate-y-8")}
          >
            <LineIcon name={icon} className="h-[38%] w-[38%] text-fg" />
          </OffsetCard>
        );
      })}
    </div>
  );
}
