/* Reads the Vite env once, in one place, so nothing else in src/ touches
   `import.meta.env` directly.

   "" and undefined both mean "not set", so an env file can list a key it does
   not want to override without blanking the default behind it. */
const env = import.meta.env;

const pick = (value, fallback) =>
  value === undefined || value === "" ? fallback : value;

const bool = (value, fallback) =>
  value === undefined || value === "" ? fallback : value === "true";

export const ENV = {
  name: pick(env.VITE_ENVIRONMENT, "dev"),
  siteUrl: pick(env.VITE_SITE_URL, "http://localhost:5173"),

  /* Feature switches — see config/sections.js for what each one picks.
     `undefined` here means "leave the default alone", which is why these
     do not carry fallbacks of their own. */
  designSystemRoute:
    env.VITE_DESIGN_SYSTEM_ROUTE === undefined || env.VITE_DESIGN_SYSTEM_ROUTE === ""
      ? undefined
      : bool(env.VITE_DESIGN_SYSTEM_ROUTE),
  componentsRoute:
    env.VITE_COMPONENTS_ROUTE === undefined || env.VITE_COMPONENTS_ROUTE === ""
      ? undefined
      : bool(env.VITE_COMPONENTS_ROUTE),

  /* Not a bool — it names one of two hero treatments. `pick` with an
     undefined fallback keeps the same "unset means leave the default
     alone" contract the switches above have. */
  homeHero: pick(env.VITE_HOME_HERO, undefined),
};

export default ENV;
