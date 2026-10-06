import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* The admin's own Vite app — separate from apps/web, with its own design
   system to come. 5174 keeps it clear of the web dev server (5173). */
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  preview: { port: 4174 },
});
