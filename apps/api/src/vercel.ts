import { createApp } from "./app.ts";
import { vercelHandlers } from "./vercelHandlers.ts";

/* The Vercel Function entry (wired by api/index.js). Vercel's Node runtime
   calls these Web-standard method handlers with a Request and sends back
   the Response (vercelHandlers.ts). The app — and with it the MongoDB
   client — is created once per function instance and reused by every
   warm invocation. */
const app = createApp();

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = vercelHandlers(app);
