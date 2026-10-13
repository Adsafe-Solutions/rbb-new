import { z } from "zod";
import { COUNTRIES, isCountryName } from "./countries.ts";

/* A country, chosen from the shared list (countries.ts: ISO 3166-1) and
   stored by its English short name — used by the Impact page's Where We
   Work block and by the settings' internal country selection. A list of
   them names each country once. */
export const CountryName = z.string().refine(isCountryName, "must be a country from the list (ISO 3166-1, English short name)");

export const countryList = (min: number, max: number = COUNTRIES.length) =>
  z
    .array(CountryName)
    .min(min)
    .max(max)
    .superRefine((countries, ctx) => {
      const seen = new Set<string>();
      countries.forEach((country, i) => {
        if (seen.has(country)) ctx.addIssue({ code: "custom", path: [i], message: `names "${country}" twice` });
        seen.add(country);
      });
    });
