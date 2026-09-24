import { useEffect, useId, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { isWithin } from "../../lib/paths.js";
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
    "inline-flex items-center gap-1.5 rounded-2xl px-3 py-2.5 xl:px-4",
    "font-medium leading-none text-[length:var(--text-body)] tracking-body text-trust-blue",
    "transition-colors hover:bg-mist",
    (active || open) && "bg-mist",
    active && "underline decoration-2 underline-offset-[6px]"
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
  const { pathname } = useLocation();
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
      <div id={panelId} hidden={!open} className="absolute left-0 top-full z-10 pt-3">
        <ul
          ref={listRef}
          onKeyDown={onPanelKeyDown}
          className="enter flex min-w-60 flex-col gap-0.5 rounded-3xl bg-paper-white p-2 shadow-sm"
        >
          {section.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end
                onClick={onClose}
                className={({ isActive }) =>
                  cx(
                    "block whitespace-nowrap rounded-2xl px-4 py-3",
                    "font-medium text-[length:var(--text-caption)] leading-caption tracking-caption text-trust-blue",
                    "transition-colors hover:bg-mist",
                    isActive && "bg-mist underline decoration-2 underline-offset-[6px]"
                  )
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
