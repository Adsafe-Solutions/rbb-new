/* Feature switches for whole sections of the site. Flip a flag and the
   section stops rendering everywhere — no other edits needed.

   Each one can also be set per deployment from a .env file, so dev can try a
   treatment prod is not running yet. The value here is the default: an unset
   env key leaves it alone rather than blanking it (see config/env.js). */
import { ENV } from "./env.js";

export const SECTIONS = {
  /* The /design-system route — the living token reference. On in dev,
     off in production builds unless a deployment asks for it. */
  designSystemRoute: ENV.designSystemRoute ?? import.meta.env.DEV,

  /* The /components route — every component rendered with its real
     variants. Same default as designSystemRoute above; the two are
     companion dev tools and ship (or don't) together. */
  componentsRoute: ENV.componentsRoute ?? import.meta.env.DEV,

  /* ── WHICH HERO THE HOMEPAGE OPENS WITH ──────────────────────────
     Change the string below and the homepage swaps. Both heroes stay
     built either way, and both are in the /components catalog.

       "bleed" — the rotating photograph running full height behind the
                 copy, with the mark bled off the left (components/HeroBleed)
       "logo"  — the appeal photograph held inside the RBB mark, on the
                 Deep Trust Blue band (components/Hero)

     Per deployment, VITE_HOME_HERO overrides this without an edit — but
     see the warning in .env.development about WHICH env file to set it in:
     .env.development loads after .env.local and will win. */
  homeHero: ENV.homeHero ?? "bleed",
};

export default SECTIONS;
