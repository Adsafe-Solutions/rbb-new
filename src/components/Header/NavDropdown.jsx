import { useEffect, useId, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { isCurrentEntry, isWithin, navTarget } from "../../lib/paths.js";
import { ChevronIcon } from "./icons.jsx";

/* One top-level item of the desktop nav, and the panel it opens.

   A disclosure — a <button> that shows and hides a list of links — and
   deliberately NOT an ARIA `menu`. `role="menu"` promises application
   keyboard behaviour and hides the links from a screen reader's links
   list; site navigation is a list of links, and the disclosure pattern
   is what WAI recommends for it. The arrow keys below are a convenience
   on top, not a requirement: Tab alone reaches every link.

   Open/closed state lives in DesktopNav, which owns the rule that only
   one panel is open at a time and the hover timing. This component owns
   the keyboard. */

/* The look every top-level item shares — trigger buttons here, the
   direct Stories link in DesktopNav. Active is Mist plus an underline:
   Mist alone is too close to white to show on its own, and a filled
   Deep Trust Blue pill would swallow the Charcoal focus ring. */
export function navItemClass({ active, open }) {
  return cx(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 xl:px-3.5",
    /* Scanned, not read: bold and a size under body, so the five items
       sit in the pill with room either side of them. */
    "text-[15px] font-bold leading-none text-trust-blue",
    "transition-colors hover:bg-mist",
    (active || open) && "bg-mist",
    /* The current section is marked by more than a tint — Light Gray
       alone is too close to white to be the only signal. */
    active && "underline decoration-bumble-honey decoration-[3px] underline-offset-[7px]"
  );
}

export default function NavDropdown({
  section,
  open,
  onToggle,
  onOpen,
  onClose,
  onPointerEnter,
  onPointerLeave,
}) {
  const location = useLocation();
  const { pathname } = location;
  const panelId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  /* Which link to focus once the panel has rendered. The panel is
     `hidden` until state catches up, and focus() on a hidden element
     does nothing — so the arrow key records its wish here and the effect
     below carries it out after the render. */
  const pendingFocus = useRef(null);

  const active = isWithin(pathname, section.to);
  const links = () => [...(listRef.current?.querySelectorAll("a") ?? [])];

  const focusLink = (index) => {
    const all = links();
    if (all.length) all[(index + all.length) % all.length].focus();
  };

  useEffect(() => {
    if (open && pendingFocus.current !== null) {
      focusLink(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [open]);

  const openAndFocus = (index) => {
    if (open) {
      focusLink(index);
    } else {
      pendingFocus.current = index;
      onOpen();
    }
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(-1);
    }
  };

  const onPanelKeyDown = (e) => {
    const all = links();
    const index = all.indexOf(document.activeElement);
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: -1 };
    if (e.key in moves) {
      e.preventDefault();
      focusLink(moves[e.key]);
    }
  };

  /* Escape from anywhere inside — the trigger or a link — closes the
     panel and puts focus back on the trigger, so the reader is where
     they were rather than on a link that just vanished. */
  const onKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      onClose();
      triggerRef.current?.focus();
    }
  };

  /* Tabbing out of the item closes it. Only when focus has actually gone
     somewhere else: a click on the panel's own padding blurs to nothing
     (relatedTarget null), and that should not shut the panel under the
     pointer. Clicks elsewhere on the page are DesktopNav's to handle. */
  const onBlur = (e) => {
    if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) onClose();
  };

  return (
    <li
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
        className={navItemClass({ active, open })}
      >
        {section.label}
        <ChevronIcon open={open} />
      </button>

      {/* `pt-3` rather than `mt-3`: the padding is part of this element,
          so the pointer crossing from the trigger to the panel never
          leaves the item, and hover does not flicker shut in the gap. */}
      <div id={panelId} hidden={!open} className="absolute left-0 top-full z-10 pt-4">
        <ul
          ref={listRef}
          onKeyDown={onPanelKeyDown}
          data-tone="card"
          className="enter flex min-w-60 flex-col gap-0.5 rounded-2xl border-rim bg-paper-white p-2 shadow-[6px_6px_0_var(--color-bumble-honey)]"
        >
          {/* Plain Links with a computed `aria-current`: NavLink ignores the
              hash, so every /about#section entry would be "current" on
              /about at once (lib/paths.js). */}
          {section.children.map((child) => {
            const current = isCurrentEntry(location, child);
            return (
              <li key={child.to}>
                <Link
                  to={navTarget(child)}
                  aria-current={current ? (child.section ? "location" : "page") : undefined}
                  onClick={onClose}
                  className={cx(
                    "block whitespace-nowrap rounded-xl px-4 py-3",
                    "text-[15px] font-semibold leading-snug text-trust-blue",
                    "transition-colors hover:bg-mist",
                    current && "bg-mist underline decoration-bumble-honey decoration-[3px] underline-offset-[6px]"
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
