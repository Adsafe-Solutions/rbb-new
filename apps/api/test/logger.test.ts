import { test } from "node:test";
import assert from "node:assert/strict";
import { createLogger } from "../src/logging/logger.ts";
import { captureLogs } from "./helpers.ts";

test("log lines are JSON with level, message, base and fields", () => {
  const logs = captureLogs();
  createLogger({ base: { service: "rbb-api" }, write: logs.write }).info("hello", { requestId: "abc12345" });
  const entry = JSON.parse(logs.lines[0]!);
  assert.equal(entry.level, "info");
  assert.equal(entry.msg, "hello");
  assert.equal(entry.service, "rbb-api");
  assert.equal(entry.requestId, "abc12345");
  assert.ok(Date.parse(entry.time));
});

test("levels below the threshold are dropped", () => {
  const logs = captureLogs();
  const log = createLogger({ level: "warn", write: logs.write });
  log.info("quiet");
  log.warn("loud");
  assert.equal(logs.lines.length, 1);
});

test("credentials are redacted by key and inside any text, errors included", () => {
  const logs = captureLogs();
  createLogger({ write: logs.write }).error("failed", {
    authorization: "Bearer abc.def.ghi",
    headers: { cookie: "session=1", "x-api-key": "k" },
    password: "hunter2",
    note: "connecting to mongodb+srv://admin:pa55word@cluster.example.net/db failed",
    key: "re_1234567890abcdefghij",
    error: new Error("auth failed for mongodb://root:toor@10.0.0.1:27017"),
  });
  const text = logs.text();
  for (const secret of ["abc.def.ghi", "session=1", "hunter2", "pa55word", "re_1234567890abcdefghij", "toor@"])
    assert.ok(!text.includes(secret), `"${secret}" reached the log`);
  assert.ok(text.includes("[redacted-uri]"));
});

test("stacks are logged only when asked for (never in production)", () => {
  const logs = captureLogs();
  createLogger({ write: logs.write }).error("x", { error: new Error("boom") });
  assert.equal(JSON.parse(logs.lines[0]!).error.stack, undefined);
  createLogger({ write: logs.write, includeStacks: true }).error("x", { error: new Error("boom") });
  assert.ok(JSON.parse(logs.lines[1]!).error.stack);
});
