import { setThemeMode, type ThemeMode } from "../design-system";
import { theme } from "./index";

/* The light/dark choice a person makes with the topbar's switch. It is a
   per-browser convenience, so localStorage is enough; storage can be
   blocked (private windows, site data off), which simply means the theme
   config's default every time. */
const KEY = "rbb.admin.themeMode";

export function preferredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return theme.defaultMode;
}

export function chooseMode(mode: ThemeMode) {
  setThemeMode(mode);
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
