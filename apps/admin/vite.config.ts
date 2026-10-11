import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* The admin's own Vite app — separate from apps/web, with its own design
   system to come. 5174 keeps it clear of the web dev server (5173).

   The admin calls the API on its OWN origin (/api/...), so the session
   cookie is first-party and SameSite=Strict holds: here Vite proxies
   /api to the local API (ADMIN_API_PROXY, default http://localhost:4000);
   in production the admin's host rewrites /api to the API deployment. The
   proxy keeps the browser's Origin header, which the API checks — so the
   API's ADMIN_ORIGIN must be this dev server's origin locally. */
const api = { "/api": { target: process.env.ADMIN_API_PROXY ?? "http://localhost:4000" } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy: api },
  preview: { port: 4174, proxy: api },
});
