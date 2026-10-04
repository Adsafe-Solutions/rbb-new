import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { isCurrentEntry, isWithin, navTarget } from "../../lib/paths.js";
import { ChevronIcon } from "./icons.jsx";
import { NAV } from "../../content/index.js";

/* The small-screen menu: the same tree as the desktop nav, as an
   accordion. Each section is a <button aria-expanded> over its list of
   links, one section open at a time so the sheet never grows taller than
   it needs to.

   Always mounted, shown and hidden with the `hidden` attribute, so the
   toggle's `aria-controls` always points at something that exists.
   Opening, closing, the scroll lock and Escape are Header's; this
   component only owns which section is expanded. */

const ROW = cx(
  "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5",
  "type-card text-trust-blue",
  "transition-colors hover:bg-mist"
);

/* Same active treatment as the desktop nav — see navItemClass. */
const ACTIVE = "bg-mist underline decoration-bumble-honey decoration-[3px] underline-offset-[6px]";

export default function MobileNav({ id, open, onNavigate }) {
  const location = useLocation();
  const { pathname } = location;
  const baseId = useId();

  /* Opens on the section the reader is already in, so the page they are
     on is visible the moment the menu is. */
  const current = NAV.find((item) => item.children && isWithin(pathname, item.to));
  const [expanded, setExpanded] = useState(current?.to ?? null);

  useEffect(() => {
    if (open) setExpanded(current?.to ?? null);
  }, [open]);

  return (
    <div
      id={id}
      hidden={!open}
      /* The sheet scrolls inside itself when the tree is long. It
         already contains its overscroll; this says the same thing to
         Lenis, which is listening to the wheel rather than to the
         scrollbar (styles/index.css). */
      data-lenis-prevent=""
      data-tone="card"
      className={cx(
        "enter max-h-[calc(100dvh-var(--header-h)-1rem)] overflow-y-auto overscroll-contain",
        "rounded-2xl border-rim bg-paper-white p-3 shadow-[6px_6px_0_var(--color-bumble-honey)]"
      )}
    >
      <nav aria-label="Primary">
        <ul className="flex flex-col gap-1">
          {NAV.map((item, i) => {
            if (!item.children) {
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) => cx(ROW, isActive && ACTIVE)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              );
            }

            const isOpen = expanded === item.to;
            const listId = `${baseId}-${i}`;

            return (
              <li key={item.to}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => setExpanded(isOpen ? null : item.to)}
                  className={cx(ROW, isOpen && "bg-mist")}
                >
                  {item.label}
                  <ChevronIcon open={isOpen} className="h-5 w-5" />
                </button>

                <ul
                  id={listId}
                  hidden={!isOpen}
                  className="mt-1 mb-2 flex flex-col gap-0.5 pl-3"
                >
                  {item.children.map((child) => {
                    const current = isCurrentEntry(location, child);
                    return (
                      <li key={child.to}>
                        <Link
                          to={navTarget(child)}
                          aria-current={current ? (child.section ? "location" : "page") : undefined}
                          onClick={onNavigate}
                          className={cx(
                            "block rounded-xl px-4 py-3",
                            "font-semibold text-[length:var(--text-body)] leading-body text-trust-blue",
                            "transition-colors hover:bg-mist",
                            current && ACTIVE
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
