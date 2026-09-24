/* LOCAL DEVELOPMENT AND TESTING ONLY — never a production server.

   Serves the built site (dist/) with its security headers and mounts the
   submission handler at POST /api/forms and the donation endpoints at
   /api/donations/* (Document 22), so both flows can be tried end to end
   on one machine. Donations need Razorpay TEST keys in server/.env.local
   (docs/DONATIONS.md); with none, they answer 503 like production. Production runs the same handler as the
   chosen host's serverless function (docs/FORMS_AND_EMAIL.md).

     EMAIL_MODE=test node server/dev-server.mjs          (default port 5190)

   Configuration comes from the environment exactly as in production
   (server/config.mjs). In "test" mode nothing is sent: each email is
   printed as one summary line (form, template subject, recipient domain)
   and the rendered HTML is written to build-meta/email-previews/. */
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerApp } from "./app.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const port = Number(process.env.PORT || 5190);
const previews = join(root, "build-meta", "email-previews");
let previewCount = 0;
const capture = async (email) => {
  await mkdir(previews, { recursive: true });
  const file = join(previews, `${String(++previewCount).padStart(3, "0")}.html`);
  await writeFile(file, email.html);
  console.log(
    `[test-mode email] "${email.subject}" → @${String(email.to).split("@")[1]} (preview ${file.slice(root.length + 1)})`
  );
};
/* The same host-neutral app a production adapter uses (server/app.mjs).
   One long-lived process here, so the in-memory limiter is honest; live
   mode still needs RATE_LIMIT_SINGLE_INSTANCE=true to say so. */
const app = createServerApp({ env: process.env, capture });
if (app.problems.email.length)
  console.warn(`email configuration problems (endpoint is off): ${app.problems.email.join("; ")}`);
if (app.problems.donations.length)
  console.warn(`donation configuration problems (donations are off): ${app.problems.donations.join("; ")}`);

const policy = JSON.parse(
  await readFile(join(root, "build-meta", "security-headers.json"), "utf8").catch(
    () => '{"headers":{}}'
  )
).headers;
/* Behaves as the production host must (docs/DEPLOYMENT.md), so the smoke
   test (scripts/smoke-test.mjs) can be proven locally: permanent 301s from
   build-meta/redirects.json, a real 404 status for unknown paths. */
const redirects = new Map(
  JSON.parse(await readFile(join(root, "build-meta", "redirects.json"), "utf8").catch(() => "[]")).map((r) => [
    r.from,
    r.to,
  ])
);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const isFile = async (p) =>
  stat(p).then(
    (s) => (s.isFile() ? p : null),
    () => null
  );

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/api/forms" || url.pathname.startsWith("/api/donations/")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const response = await app.handle(request, { clientIp: req.socket.remoteAddress });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const path = decodeURIComponent(url.pathname);
  const target = redirects.get(path.replace(/\/+$/, "") || "/");
  if (target) {
    res.writeHead(301, { Location: target + url.search, "Cache-Control": "no-cache" });
    res.end();
    return;
  }
  let file =
    (await isFile(join(dist, path))) || (await isFile(join(dist, path, "index.html")));
  let status = 200;
  if (!file || !file.startsWith(dist)) {
    file = join(dist, "404.html");
    status = 404;
  }
  res.writeHead(status, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    ...policy["/*"],
    /* A preview of the production artifact must not be indexed; real
       hosts add this per deployment (docs/HOST_CONFIGURATION.md). */
    ...(process.env.PREVIEW_NOINDEX === "true" ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    ...(policy[path] ?? {}),
    ...(path.startsWith("/assets/") ? policy["/assets/*"] : {}),
  });
  res.end(await readFile(file));
}).listen(port, () =>
  console.log(
    `local site + form and donation endpoints on http://localhost:${port} (EMAIL_MODE=${app.emailMode}, donations=${app.donationMode})`
  )
);
