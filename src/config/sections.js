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

  /* The colour-theme switcher, bottom-left (components/ThemeSwitcher).
     HIDDEN for now (RBB, Oct 2026): the themes are built (styles/
     index.css) but no visitor can choose one until a deployment sets
     VITE_THEME_SWITCHER=true. index.html applies a saved theme only
     under the same switch, so with it off the site is always RBB's own
     palette. */
  themeSwitcher: ENV.themeSwitcher,
};

export default SECTIONS;
