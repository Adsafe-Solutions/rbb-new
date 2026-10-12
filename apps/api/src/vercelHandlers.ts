import type { App } from "./app.ts";

/* The Vercel Function's Web-standard method handlers for an app.

   vercel.json rewrites every path to the one function (api/index.js), and
   Vercel hands that function the request AS THE CLIENT MADE IT: the
   original URL, path and method — so the app's router matches the path it
   always does ("/api/v1/public/snapshot", not the rewrite's "/api"). The
   client address is the one Vercel's edge recorded: Vercel sets
   x-real-ip itself and does not pass a client-supplied value through, so
   on Vercel it can be trusted. Separate from vercel.ts so the handlers can
   be tested against any app without creating the real one. */
export function vercelHandlers(app: Pick<App, "handle">) {
  const handle = (request: Request) => app.handle(request, { clientIp: request.headers.get("x-real-ip") });
  return { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle, OPTIONS: handle };
}
