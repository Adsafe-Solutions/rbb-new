import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* Tailwind v4 is a Vite plugin, not a PostCSS step — there is no
   tailwind.config.js and no postcss.config.js in this project. The theme lives
   in CSS, at src/styles/theme.css, and that file is the single source of truth
   for every colour, size and radius the site can use. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
});
