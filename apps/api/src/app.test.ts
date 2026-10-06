import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { handle } from "./app.ts";

async function request(path: string) {
  const server = createServer(handle).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    return await fetch(`http://localhost:${port}${path}`);
  } finally {
    server.close();
  }
}

test("GET /health answers ok", async () => {
  const res = await request("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("anything else is a 404", async () => {
  const res = await request("/v1/anything");
  assert.equal(res.status, 404);
});
