import { useEffect, useId, useRef, useState } from "react";
import { SITE } from "../../content/index.js";

/* The colour-theme switcher: a round button fixed to the bottom-left
   corner that opens a small card of the site's three palettes (RBB's
   own, and the two in styles/index.css). Rendered only when
   config/sections.js `themeSwitcher` is on.

   The choice is set as <html data-theme="…"> (no attribute = RBB's
   palette) and remembered in the visitor's OWN browser (localStorage,
   key "rbb-theme"). Nothing is written until a visitor actually picks a
   theme; index.html re-applies it before first paint on the next visit.

   The options are native radios in a fieldset, so arrow keys move
   between them and a screen reader hears the group. Escape or a click
   outside closes the card and returns focus to the button. */
const KEY = "rbb-theme";
const THEMES = SITE.themes.options;

function applyTheme(id) {
  const root = document.documentElement;
  if (id === "rbb") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  try {
    if (id === "rbb") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    /* Storage blocked (private mode, settings): the theme still applies
       for this page view. */
  }
}

export default function ThemeSwitcher() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  /* "rbb" on the server and on the first client render, so hydration
     matches; the real value is read from <html> once mounted. */
  const [current, setCurrent] = useState("rbb");
  const button = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    setCurrent(document.documentElement.getAttribute("data-theme") || "rbb");
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector("input:checked")?.focus();
    const close = (returnFocus) => {
      setOpen(false);
      if (returnFocus) button.current?.focus();
    };
    const onKey = (e) => e.key === "Escape" && close(true);
    const onDown = (e) => {
      if (!panel.current?.contains(e.target) && !button.current?.contains(e.target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const choose = (id) => {
    setCurrent(id);
    applyTheme(id);
  };

  return (
    <div data-tone="card" className="fixed bottom-4 left-4 z-40 bg-transparent! md:bottom-6 md:left-6">
      {open && (
        <div
          id={panelId}
          ref={panel}
          className="absolute bottom-full left-0 mb-3 w-60 rounded-2xl border-rim bg-ground p-4 cast"
        >
          <fieldset className="m-0 border-0 p-0">
            <legend className="type-meta mb-3 text-fg">{SITE.themes.legend}</legend>
            <div className="grid gap-1.5">
              {THEMES.map((theme) => (
                <label key={theme.id} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="rbb-theme"
                    value={theme.id}
                    checked={current === theme.id}
                    onChange={() => choose(theme.id)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-transparent px-3 py-2 font-semibold text-fg transition-colors hover:bg-hair peer-checked:border-edge peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--tone-ring)]">
                    <span aria-hidden="true" className="flex -space-x-1.5">
                      {theme.swatches.map((c) => (
                        <span key={c} className="h-5 w-5 rounded-full border-2 border-[var(--tone-edge)]" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    {theme.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      <button
        ref={button}
        type="button"
        aria-label={SITE.themes.toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full border-rim bg-ground text-fg cast-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--tone-ring)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {/* A palette. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
          <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
          <circle cx="10" cy="7" r="1.2" fill="currentColor" />
          <circle cx="14.5" cy="7" r="1.2" fill="currentColor" />
          <circle cx="17" cy="11" r="1.2" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
