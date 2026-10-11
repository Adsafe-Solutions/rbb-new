import { createServer, type IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";
import { createApp } from "../../src/app.ts";
import { R2Storage } from "../../src/modules/media/r2.ts";
import { startFakeR2 } from "./fake-r2.ts";

/* TEST-ONLY: the API exactly as src/server.ts runs it, except that media
   storage is the real R2Storage pointed at the fake R2 server — for the
   admin's browser tests (apps/admin/scripts/smoke-media.mjs). Reads the
   same environment as the dev server (a LOCAL MongoDB); never R2_*. */
const port = Number(process.env.PORT) || 4000;
const fake = await startFakeR2({ port: Number(process.env.FAKE_R2_PORT) || 4566, origins: [process.env.ADMIN_ORIGIN ?? "http://localhost:5174"] });
/* FAKE_R2_PUBLIC_URL: serve public URLs under another origin (e.g.
   https://media.rbb.test/public) for website builds, whose production gate
   rightly refuses localhost addresses; a browser test then routes that
   host to this fake. Default: the fake's own http://127.0.0.1 URL. */
const storage = new R2Storage({ endpoint: fake.url, bucket: fake.bucket, credentials: fake.credentials, publicBaseUrl: process.env.FAKE_R2_PUBLIC_URL ?? fake.publicBaseUrl });
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("R2_")));
const app = createApp({ env, storage });

const toHeaders = (incoming: IncomingHttpHeaders) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  return headers;
};

createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const request = new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method,
    headers: toHeaders(req.headers),
    ...(method !== "GET" && method !== "HEAD" && { body: Readable.toWeb(req) as ReadableStream, duplex: "half" }),
  } as RequestInit);
  const response = await app.handle(request, { clientIp: req.socket.remoteAddress ?? null });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`API on http://localhost:${port} with fake R2 at ${fake.url}`));
