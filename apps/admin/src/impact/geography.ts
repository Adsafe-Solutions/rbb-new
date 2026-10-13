import { COUNTRY_NAMES } from "@rbb/content-schema/countries";
import { idFrom } from "../blocks/ids.ts";

/* #6 / D14 — Where We Work: plain helpers for the Impact page's geography
   block form (impact/BlockEditor, impact/CountryPicker). Unit-tested
   (scripts/test).

   The country list is the OPTIONS (ISO 3166-1), never where RBB works:
   nothing is selected until an editor selects it, and only what is
   selected — then approved and published — appears on the website. */

/* A region's id, from its name, unique among the block's other regions. */
export const regionId = (name: string, regions: readonly { id: string }[]): string => idFrom(name, regions, "region");

const fold = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/* The countries whose name contains the search, ignoring case and accents
   ("cote" finds Côte d'Ivoire). An empty search lists them all. */
export function countryMatches(query: string, names: readonly string[] = COUNTRY_NAMES): string[] {
  const q = fold(query.trim());
  return q ? names.filter((name) => fold(name).includes(q)) : [...names];
}

const ORDER = new Map(COUNTRY_NAMES.map((name, i) => [name, i]));

/* The selection with one country added or removed, kept in the list's
   (alphabetical) order, so the website lists them the same way whatever
   order they were ticked in. A name not on the list is kept, at the end,
   so the form can show it and offer to remove it. */
export function toggleCountry(value: readonly string[], name: string, on: boolean): string[] {
  const next = on ? [...new Set([...value, name])] : value.filter((v) => v !== name);
  return next.sort((a, b) => (ORDER.get(a) ?? Infinity) - (ORDER.get(b) ?? Infinity) || a.localeCompare(b));
}

/* Countries already placed elsewhere in the block — name → where — so a
   country is offered in one place only (the contract refuses it twice).
   `here` is the list being edited: a region's index, or "ungrouped". */
export function takenElsewhere(geography: { regions: readonly { name: string; countries: readonly string[] }[]; countries: readonly string[] }, here: number | "ungrouped"): Map<string, string> {
  const taken = new Map<string, string>();
  geography.regions.forEach((region, i) => {
    if (i === here) return;
    for (const country of region.countries) taken.set(country, region.name.trim() ? `region “${region.name.trim()}”` : `region ${i + 1}`);
  });
  if (here !== "ungrouped") for (const country of geography.countries) taken.set(country, "the countries not in a region");
  return taken;
}

/* Selected names that are not on the list (a value stored before the list
   existed): shown with a Remove button, as record pickers do. */
export const unknownCountries = (value: readonly string[]): string[] => value.filter((name) => !ORDER.has(name));
