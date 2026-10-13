import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Checkbox, ChevronDown, Input, Search, Trash2 } from "../design-system";
import { countryMatches, toggleCountry, unknownCountries } from "./geography";
import styles from "../blocks/blocks.module.css";

/* D14 — choose countries from the full list (ISO 3166-1): a dropdown
   that opens a searchable list, several at once. The selected countries
   stay listed above it, each with Remove. The list is the options, not
   RBB's coverage: nothing is selected until an editor selects it. A
   country already placed elsewhere (`taken`) is shown but cannot be
   ticked here. No map. Used by the Impact page's Where We Work block and
   by Settings → General. */
export function CountryPicker({ label, helper, value, onChange, taken, max, disabled, error }: { label: string; helper?: string; value: string[]; onChange: (value: string[]) => void; taken: Map<string, string>; max: number; disabled: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => countryMatches(query), [query]);
  const unknown = unknownCountries(value);
  const full = value.length >= max;
  const panelId = useId();
  const root = useRef<HTMLFieldSetElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);

  /* Open: focus the search. Closed by Escape (focus back on the button) or
     a click outside. */
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <fieldset className={styles.group} ref={root} onKeyDown={(e) => open && e.key === "Escape" && (e.stopPropagation(), close())}>
      <legend className={styles.legend}>{label}</legend>
      <p className={styles.help}>
        {helper ? `${helper} ` : ""}
        {value.length ? `${value.length} selected` : "None selected"} — up to {max}.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {value.length > 0 && (
        <ul className={styles.unlistedItems} aria-label={`${label}: selected`}>
          {value.map((name) => (
            <li key={name} className={styles.unlistedItem}>
              <span>
                {name}
                {unknown.includes(name) && <span className={`${styles.error} ${styles.itemError}`}> Not on the country list — remove it and choose from the list.</span>}
              </span>
              <Button size="sm" leadingIcon={<Trash2 />} disabled={disabled} onClick={() => onChange(toggleCountry(value, name, false))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button ref={trigger} trailingIcon={<ChevronDown />} disabled={disabled} aria-expanded={open} aria-controls={panelId} onClick={() => (open ? close() : setOpen(true))}>
          {open ? "Close the list" : "Select countries"}
        </Button>
      </div>
      {open && (
        <div id={panelId} className={styles.countryPanel} role="group" aria-label={`${label}: all countries`}>
          <Input ref={search} type="search" aria-label={`Search countries — ${label}`} placeholder="Search countries" leadingIcon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} />
          {options.length === 0 ? (
            <p className={styles.help}>No country matches “{query.trim()}”.</p>
          ) : (
            <ul className={styles.picker} aria-label={`${label}: countries`}>
              {options.map((name) => {
                const on = value.includes(name);
                const elsewhere = taken.get(name);
                return (
                  <li key={name}>
                    <Checkbox
                      label={name}
                      description={!on && elsewhere ? `Already in ${elsewhere}` : undefined}
                      checked={on}
                      disabled={disabled || (!on && (Boolean(elsewhere) || full))}
                      onChange={(e) => onChange(toggleCountry(value, name, e.target.checked))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
