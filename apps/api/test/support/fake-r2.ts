import { createServer, type IncomingMessage, type Server } from "node:http";
import { amzDate, presignUrl, signHeaders, type Credentials } from "../../src/modules/media/sigv4.ts";

/* TEST-ONLY stand-in for R2's S3 API, for browser tests of the upload
   flow without touching a real bucket. It is strict where R2 is:

     · a presigned PUT is accepted only if its signature recomputes from
       the request AS RECEIVED (method, path, Content-Type, Content-Length,
       host) with the shared credentials, and it has not expired
     · the API's own HEAD / GET / DELETE must carry a valid header
       signature
     · CORS answers only the listed origins, for PUT with Content-Type —
       the same rule the real bucket needs

   Objects live in memory; GET /public/<key> serves them like the bucket's
   public domain. Never part of the API bundle. */

export interface FakeR2 {
  url: string;
  bucket: string;
  credentials: Credentials;
  publicBaseUrl: string;
  objects: Map<string, { bytes: Buffer; contentType: string }>;
  rejected: string[];
  close(): Promise<void>;
}

const SCOPE = { region: "auto", service: "s3" } as const;

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

const parseAmzDate = (value: string) => new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`);

export async function startFakeR2({ port = 0, origins }: { port?: number; origins: string[] }): Promise<FakeR2> {
  const bucket = "media-test";
  const credentials = { accessKeyId: `FAKE${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, secretAccessKey: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "") };
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  const rejected: string[] = [];

  const server: Server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors: Record<string, string> = origin && origins.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const send = (status: number, body: string | Buffer = "", headers: Record<string, string> = {}) => {
      res.writeHead(status, { ...cors, ...headers });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    const deny = (why: string) => {
      rejected.push(why);
      send(403, `<Error><Code>AccessDenied</Code><Message>${why}</Message></Error>`, { "Content-Type": "application/xml" });
    };
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      if (!cors["Access-Control-Allow-Origin"] || req.headers["access-control-request-method"] !== "PUT") return send(403);
      return send(204, "", { "Access-Control-Allow-Methods": "PUT", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "600" });
    }

    if (req.method === "GET" && url.pathname.startsWith("/public/")) {
      const object = objects.get(decodeURIComponent(url.pathname.slice("/public/".length)));
      return object ? send(200, object.bytes, { "Content-Type": object.contentType, "Content-Length": String(object.bytes.length) }) : send(404);
    }

    if (!url.pathname.startsWith(`/${bucket}/`)) return send(404);
    const key = url.pathname.slice(bucket.length + 2).split("/").map(decodeURIComponent).join("/");

    if (req.method === "PUT") {
      const params = url.searchParams;
      const signature = params.get("X-Amz-Signature");
      const date = params.get("X-Amz-Date");
      const expires = Number(params.get("X-Amz-Expires"));
      if (!signature || !date || !expires) return deny("not presigned");
      if (Date.now() > parseAmzDate(date).getTime() + expires * 1000) return deny("expired");
      const signed = (params.get("X-Amz-SignedHeaders") ?? "").split(";").filter((h) => h !== "host");
      const headers = Object.fromEntries(signed.map((h) => [h, String(req.headers[h] ?? "")]));
      const base = new URL(`${url.origin}${url.pathname}`);
      const expected = new URL(presignUrl({ method: "PUT", url: base, headers, credentials, scope: SCOPE, date: parseAmzDate(date), expiresInSeconds: expires })).searchParams.get("X-Amz-Signature");
      if (expected !== signature) return deny("signature mismatch");
      const body = await readBody(req);
      if (String(body.length) !== String(req.headers["content-length"])) return deny("length mismatch");
      objects.set(key, { bytes: body, contentType: String(req.headers["content-type"] ?? "application/octet-stream") });
      return send(200, "", { ETag: `"${body.length}"` });
    }

    // The API's own calls: header-signed.
    const date = String(req.headers["x-amz-date"] ?? "");
    const range: Record<string, string> = req.headers.range ? { range: String(req.headers.range) } : {};
    const expected = signHeaders({ method: req.method ?? "GET", url, headers: range, credentials, scope: SCOPE, date: parseAmzDate(date) }).authorization;
    if (!date || req.headers.authorization !== expected || amzDate(parseAmzDate(date)) !== date) return deny("bad header signature");
    const object = objects.get(key);
    if (req.method === "DELETE") {
      objects.delete(key);
      return send(204);
    }
    if (!object) return send(404);
    if (req.method === "HEAD") return send(200, "", { "Content-Type": object.contentType, "Content-Length": String(object.bytes.length) });
    const match = /^bytes=0-(\d+)$/.exec(String(req.headers.range ?? ""));
    const bytes = match ? object.bytes.subarray(0, Number(match[1]) + 1) : object.bytes;
    return send(match ? 206 : 200, bytes, { "Content-Type": object.contentType });
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`;
  return {
    url,
    bucket,
    credentials,
    publicBaseUrl: `${url}/public`,
    objects,
    rejected,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
