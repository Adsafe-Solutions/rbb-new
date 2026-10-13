import type { ThemeConfig } from "../design-system";
import mark from "./assets/rbb-mark.png";

/* Rising Beyond Borders — the admin's brand. The ONLY place RBB's colours,
   names and logo are written down for the admin. Another organization
   copies this file, changes the values, and points src/theme/index.ts at
   the copy.

   The mark is a 128px copy of `Rising Beyond Borders Logo-09.png` from the
   web app's supplied logo set (Sky Blue mark, no lettering). */
export const rbbTheme: ThemeConfig = {
  identity: {
    organizationName: "Rising Beyond Borders",
    productName: "RBB Studio",
    logo: { src: mark, monogram: "RBB" },
  },
  colors: {
    primary: "#28282B", // Ink — the website's colour in place of Deep Trust Blue (2026-10-13)
    onPrimary: "#FFFFFF",
    accent: "#00ADEF", // Sky Blue
    success: "#5CB85C", // Growth Green
    surface: "#FFFFFF", // White
    surfaceSubtle: "#F5F7FA", // Light Gray
    text: "#3A3A3A", // Charcoal
  },
  defaultMode: "light",
};
