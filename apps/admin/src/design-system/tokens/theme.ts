/* Layer 3 — BRAND. The values an organization supplies, and the one
   function that applies them.

   A theme config (src/theme/rbb.ts for RBB) is plain data. applyTheme()
   writes its colours onto <html> as `--brand-*` custom properties, which
   the semantic layer (semantic.css) reads and derives every state from.
   Components never see a brand value directly, so a fork rebrands by
   writing a new config, not by touching components. */

export type ThemeMode = "light" | "dark";

export interface BrandColors {
  /** The action colour: primary buttons, links, the selected state. */
  primary: string;
  /** Text and icons drawn on `primary`. */
  onPrimary: string;
  /** Marks and tints only — never used as text on a light surface. */
  accent: string;
  /** The success hue; success text is a darkened mix of it. */
  success: string;
  /** Cards, panels, the sidebar and topbar. */
  surface: string;
  /** The page canvas behind the cards. */
  surfaceSubtle: string;
  /** Body text. */
  text: string;
}

export interface BrandIdentity {
  /** The organization, e.g. in the sidebar and sign-in screen. */
  organizationName: string;
  /** The admin product's own name, e.g. in the browser tab. */
  productName: string;
  /** A square mark. `src` is an imported asset URL; without one, the
   * `monogram` is drawn instead. `alt` stays empty when the name is
   * written beside the mark (the usual case). */
  logo: { src?: string; monogram: string };
}

export interface ThemeConfig {
  identity: BrandIdentity;
  colors: BrandColors;
  /** The mode people get until they choose one with the topbar switch. */
  defaultMode: ThemeMode;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const VARIABLES: Record<keyof BrandColors, string> = {
  primary: "--brand-primary",
  onPrimary: "--brand-on-primary",
  accent: "--brand-accent",
  success: "--brand-success",
  surface: "--brand-surface",
  surfaceSubtle: "--brand-surface-subtle",
  text: "--brand-text",
};

/** Write a theme's brand layer onto <html>. Call once, before the first
 * render. Set through the CSSOM, so a strict style-src policy allows it. */
export function applyTheme(theme: ThemeConfig, root: HTMLElement = document.documentElement) {
  for (const [key, variable] of Object.entries(VARIABLES) as [keyof BrandColors, string][]) {
    const value = theme.colors[key];
    if (!HEX.test(value)) throw new Error(`Theme colour "${key}" must be a hex value, got "${value}".`);
    root.style.setProperty(variable, value);
  }
  setThemeMode(theme.defaultMode, root);
  document.title = theme.identity.productName;
  if (theme.identity.logo.src) {
    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.head.appendChild(document.createElement("link"));
    icon.rel = "icon";
    icon.href = theme.identity.logo.src;
  }
}

export function setThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement) {
  root.dataset.theme = mode;
}
