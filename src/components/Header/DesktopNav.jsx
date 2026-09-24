import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import NavDropdown, { navItemClass } from "./NavDropdown.jsx";
import { NAV } from "../../content/index.js";

/* The desktop nav: one white pill holding the five top-level items, four
   of them dropdowns. Hidden below `lg`, where MobileNav takes over.

   Solid white rather than the translucent pill it used to be: the home
   hero puts Deep Trust Blue directly behind the header, and Deep Trust
   Blue text on a 45%-white wash over Deep Trust Blue came out near 3:1.

   Opening works three ways, and none of them is required:
     click / Enter / Space   toggles, and the panel stays until dismissed
     ArrowDown               opens and moves into the list
     mouse hover             opens, and closes shortly after leaving
   Clicking a panel that hover opened PINS it rather than closing it —
   otherwise the most natural thing a mouse user does (hover, then click
   the label they are pointing at) would shut the menu they just saw
   appear. Touch and pen never hover-open; `pointerType` filters them. */

/* Long enough to cross the gap to a panel on a diagonal, short enough
   that moving to the next item does not leave two panels up. */
const CLOSE_DELAY_MS = 180;

export default function DesktopNav() {
  const { pathname } = useLocation();
  const [openTo, setOpenTo] = useState(null);
  const pinned = useRef(false);
  const closeTimer = useRef(null);
  const navRef = useRef(null);

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    setOpenTo(null);
  };

  /* A route change closes everything. Covers links followed by keyboard
     and the browser's back button, which never pass through onClick. */
  useEffect(close, [pathname]);
  useEffect(() => cancelClose, []);

  /* While a panel is open: a press anywhere outside the nav closes it,
     and so does Escape — from anywhere, since a hover-opened panel may
     have nothing inside it focused. NavDropdown handles the Escape that
     starts inside it and returns focus to its trigger. */
  useEffect(() => {
    if (!openTo) return undefined;

    const onPointerDown = (e) => {
      if (!navRef.current?.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openTo]);

  const open = (to) => {
    cancelClose();
    pinned.current = true;
    setOpenTo(to);
  };

  const toggle = (to) => {
    if (openTo !== to) return open(to);
    if (!pinned.current) {
      pinned.current = true;
      return undefined;
    }
    return close();
  };

  const hoverIn = (to) => (e) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    if (openTo !== to) {
      pinned.current = false;
      setOpenTo(to);
    }
  };

  const hoverOut = (e) => {
    if (e.pointerType !== "mouse" || pinned.current) return;
    closeTimer.current = setTimeout(() => setOpenTo(null), CLOSE_DELAY_MS);
  };

  return (
    <nav ref={navRef} aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center rounded-2xl bg-paper-white p-1.5">
        {NAV.map((item) =>
          item.children ? (
            <NavDropdown
              key={item.to}
              section={item}
              open={openTo === item.to}
              onToggle={() => toggle(item.to)}
              onOpen={() => open(item.to)}
              onClose={close}
              onPointerEnter={hoverIn(item.to)}
              onPointerLeave={hoverOut}
            />
          ) : (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => navItemClass({ active: isActive })}
              >
                {item.label}
              </NavLink>
            </li>
          )
        )}
      </ul>
    </nav>
  );
}
