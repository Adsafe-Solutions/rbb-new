import { createApp } from "./app.ts";

/* The Vercel Function entry (wired by api/index.js). Vercel's Node runtime
   calls these Web-standard method handlers with a Request and sends back
   the Response. The app — and with it the MongoDB client — is created once
   per function instance and reused by every warm invocation. */
const app = createApp();
const handle = (request: Request) => app.handle(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
