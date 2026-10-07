import { createServer, type IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";
import { createApp } from "./app.ts";

/* Local development server: Node's http server in front of the same
   Fetch-standard app Vercel runs (src/vercel.ts). One app per process. */
const app = createApp();
const port = Number(process.env.PORT) || 4000;

const toHeaders = (incoming: IncomingHttpHeaders) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
};

createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const request = new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method,
    headers: toHeaders(req.headers),
    ...(method !== "GET" && method !== "HEAD" && { body: Readable.toWeb(req) as ReadableStream, duplex: "half" }),
  } as RequestInit);
  const response = await app.handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  app.log.info("listening", { url: `http://localhost:${port}` });
});
