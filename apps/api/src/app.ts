import type { IncomingMessage, ServerResponse } from "node:http";

/* The API's request handler. M0 is a foundation only: a health check and
   nothing else — no database, auth or modules yet (M2 onwards). */
export function handle(req: IncomingMessage, res: ServerResponse): void {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && pathname === "/health") return send(res, 200, { status: "ok" });
  send(res, 404, { error: "not-found" });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-store",
  });
  res.end(json);
}
