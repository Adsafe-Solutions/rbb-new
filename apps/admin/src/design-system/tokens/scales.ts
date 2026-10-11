/* The token NAMES, for documentation and the /design-system preview.
   The values live in the CSS (primitives.css, typography.css,
   semantic.css); these lists only say which tokens exist. */

export const SPACING = [
  { token: "--space-1", px: 4 },
  { token: "--space-2", px: 8 },
  { token: "--space-3", px: 12 },
  { token: "--space-4", px: 16 },
  { token: "--space-5", px: 20 },
  { token: "--space-6", px: 24 },
  { token: "--space-8", px: 32 },
  { token: "--space-10", px: 40 },
  { token: "--space-12", px: 48 },
  { token: "--space-16", px: 64 },
] as const;

export const RADII = [
  { token: "--radius-sm", px: 4, use: "Checkboxes, small chips" },
  { token: "--radius-md", px: 6, use: "Buttons, inputs, menu items" },
  { token: "--radius-lg", px: 8, use: "Cards, panels, menus, tables" },
  { token: "--radius-xl", px: 10, use: "Dialogs" },
] as const;

export const SHADOWS = [
  { token: "--shadow-dropdown", use: "Dropdown menus" },
  { token: "--shadow-popover", use: "Popovers" },
  { token: "--shadow-dialog", use: "Dialogs and drawers" },
  { token: "--shadow-command", use: "Command menu (future)" },
  { token: "--shadow-toast", use: "Toasts" },
] as const;

export const TYPE_ROLES = [
  { role: "display", sample: "Rising together" },
  { role: "h1", sample: "Page title" },
  { role: "h2", sample: "Section title" },
  { role: "h3", sample: "Card title" },
  { role: "body", sample: "Body copy for descriptions and longer text in forms and panels." },
  { role: "body-small", sample: "Secondary copy, table cells and metadata." },
  { role: "label", sample: "Form label" },
  { role: "caption", sample: "Helper text and captions" },
  { role: "mono", sample: "org_8f3a · 2026-10-07" },
] as const;

export const COLOR_GROUPS = [
  {
    name: "Grounds",
    tokens: ["--color-bg-canvas", "--color-bg-surface", "--color-bg-subtle", "--color-bg-muted", "--color-bg-selected", "--color-bg-inverse"],
  },
  { name: "Lines", tokens: ["--color-border-subtle", "--color-border", "--color-border-strong", "--color-border-control"] },
  { name: "Text", tokens: ["--color-text-strong", "--color-text", "--color-text-muted", "--color-text-subtle", "--color-text-disabled", "--color-text-link"] },
  { name: "Brand", tokens: ["--color-primary", "--color-primary-hover", "--color-primary-subtle", "--color-accent", "--color-accent-subtle", "--color-focus-ring"] },
  {
    name: "Status",
    tokens: ["--color-info-fg", "--color-success-fg", "--color-warning-fg", "--color-danger-fg", "--color-scheduled-fg", "--color-danger-solid"],
  },
] as const;

/** Text-on-ground pairs that must meet WCAG AA, checked live on the
 * preview page. `min` is 4.5 for text and 3 for non-text indicators. */
export const CONTRAST_PAIRS = [
  { fg: "--color-text", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-text", bg: "--color-bg-canvas", min: 4.5 },
  { fg: "--color-text-strong", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-text-muted", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-text-muted", bg: "--color-bg-canvas", min: 4.5 },
  { fg: "--color-text-subtle", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-text-subtle", bg: "--color-bg-canvas", min: 4.5 },
  { fg: "--color-text-link", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-on-primary", bg: "--color-primary", min: 4.5 },
  { fg: "--color-on-primary", bg: "--color-primary-hover", min: 4.5 },
  { fg: "--color-text-inverse", bg: "--color-danger-solid", min: 4.5 },
  { fg: "--color-text-inverse", bg: "--color-bg-inverse", min: 4.5 },
  { fg: "--color-neutral-fg", bg: "--color-neutral-bg", min: 4.5 },
  { fg: "--color-brand-fg", bg: "--color-brand-bg", min: 4.5 },
  { fg: "--color-info-fg", bg: "--color-info-bg", min: 4.5 },
  { fg: "--color-success-fg", bg: "--color-success-bg", min: 4.5 },
  { fg: "--color-warning-fg", bg: "--color-warning-bg", min: 4.5 },
  { fg: "--color-danger-fg", bg: "--color-danger-bg", min: 4.5 },
  { fg: "--color-scheduled-fg", bg: "--color-scheduled-bg", min: 4.5 },
  { fg: "--color-danger-fg", bg: "--color-bg-surface", min: 4.5 },
  { fg: "--color-focus-ring", bg: "--color-bg-surface", min: 3 },
  { fg: "--color-focus-ring", bg: "--color-bg-canvas", min: 3 },
  { fg: "--color-border-control", bg: "--color-bg-surface", min: 3 },
  { fg: "--color-primary", bg: "--color-bg-selected", min: 4.5 },
] as const;
