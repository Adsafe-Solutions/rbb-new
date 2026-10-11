/* Build-time switches. Vite replaces these at build time, so a production
   build without the flag contains no design-system preview code at all. */

/** The internal /design-system preview: on in `vite dev`, and in a build
 * only when VITE_ADMIN_DESIGN_SYSTEM=true is set deliberately. */
export const SHOW_DESIGN_SYSTEM: boolean = import.meta.env.DEV || import.meta.env.VITE_ADMIN_DESIGN_SYSTEM === "true";

/** The public website's origin (e.g. https://www.example.org), for "open
 * on the website" links to already-published pages. Optional: without it
 * the admin shows the page's path only. Never used to preview drafts. */
export const PUBLIC_SITE_URL: string | null = /^https:\/\/[^/\s]+$/.test(import.meta.env.VITE_PUBLIC_SITE_URL ?? "") ? import.meta.env.VITE_PUBLIC_SITE_URL! : null;
