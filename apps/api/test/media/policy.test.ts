import { test } from "node:test";
import assert from "node:assert/strict";
import { MediaId } from "@rbb/content-schema";
import { MEDIA_POLICY, cleanDisplayName, isMediaMimeType, keySafeName, newObjectKey } from "../../src/modules/media/policy.ts";
import { SNIFF_BYTES, sniffImage } from "../../src/modules/media/sniff.ts";
import { fixture } from "./memory.ts";

test("allow-list: raster images only — no SVG, GIF, HTML, PDF or anything else", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) assert.ok(isMediaMimeType(type), type);
  for (const type of ["image/svg+xml", "image/gif", "text/html", "application/pdf", "application/octet-stream", "video/mp4", "", "__proto__", "constructor"])
    assert.ok(!isMediaMimeType(type), type);
  assert.equal(MEDIA_POLICY.maxBytes, 10 * 1024 * 1024);
  assert.ok(MEDIA_POLICY.uploadUrlTtlSeconds <= 600, "presigned URLs are short-lived");
});

test("object keys: org-scoped, unique, environment-prefixed, never the raw filename", () => {
  const a = newObjectKey({ orgId: "rbb", filename: "Photo.JPG", mimeType: "image/jpeg", env: "production" });
  const b = newObjectKey({ orgId: "rbb", filename: "Photo.JPG", mimeType: "image/jpeg", env: "production" });
  assert.match(a, /^rbb\/media\/[0-9a-f-]{36}\/photo\.jpg$/);
  assert.notEqual(a, b, "the same name twice gets two keys — nothing is overwritten");
  assert.match(newObjectKey({ orgId: "rbb", filename: "x.png", mimeType: "image/png", env: "development" }), /^_development\/rbb\/media\//);
  assert.match(newObjectKey({ orgId: "rbb", filename: "x.png", mimeType: "image/png", env: "test" }), /^_test\/rbb\/media\//);
  assert.throws(() => newObjectKey({ orgId: "../other", filename: "x.png", mimeType: "image/png", env: "test" }));
});

test("key-safe names: traversal, markup, unicode and empty names are neutralised", () => {
  const cases: [string, string][] = [
    ["../../etc/passwd.jpg", "etc-passwd.jpg"],
    ["..\\..\\windows\\win.ini.png", "windows-win-ini.png"],
    ["<script>alert(1)</script>.png", "script-alert-1-script.png"],
    ["Café Ñandú — été 2026.JPEG", "cafe-nandu-ete-2026.jpg"],
    ["%2e%2e%2fsecret.webp", "2e-2e-2fsecret.webp"],
    ["....jpg", "image.jpg"],
    ["漢字.png", "image.png"],
    ["photo.png", "photo.png"],
  ];
  for (const [input, expected] of cases) {
    const mime = input.toLowerCase().endsWith("webp") ? "image/webp" : /jpe?g$/i.test(input) ? "image/jpeg" : "image/png";
    assert.equal(keySafeName(input, mime), expected, input);
  }
  // The extension follows the TYPE: a .png name declared as JPEG is stored .jpg.
  assert.equal(keySafeName("x.png", "image/jpeg"), "x.jpg");
  assert.ok(keySafeName("a".repeat(500) + ".png", "image/png").length <= 84);
});

test("display names: path stripped, control characters removed, bounded", () => {
  assert.equal(cleanDisplayName("C:\\Users\\me\\Pictures\\team photo.jpg"), "team photo.jpg");
  assert.equal(cleanDisplayName("a\u0000b\u001f\u007fc.png"), "abc.png");
  assert.equal(cleanDisplayName("   spaced    out.png  "), "spaced out.png");
  assert.equal(cleanDisplayName("x".repeat(400)).length, 255);
});

test("sniffing: every supported format is recognised with its real dimensions", () => {
  for (const [file, mimeType] of [
    ["sample.jpg", "image/jpeg"],
    ["sample.png", "image/png"],
    ["sample.webp", "image/webp"],
    ["sample-lossless.webp", "image/webp"],
    ["sample.avif", "image/avif"],
  ] as const) {
    const sniffed = sniffImage(fixture(file).slice(0, SNIFF_BYTES));
    assert.deepEqual(sniffed, { mimeType, width: 48, height: 32 }, file);
  }
});

test("sniffing: markup, SVG, PDF and junk are not images", () => {
  const text = (s: string) => new TextEncoder().encode(s);
  for (const bytes of [
    text("<!doctype html><html><script>alert(1)</script>"),
    text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    text("%PDF-1.7\n"),
    text("GIF89a......"),
    new Uint8Array([0x89, 0x50, 0x4e]),
    new Uint8Array(0),
  ])
    assert.equal(sniffImage(bytes), null);
});

test("media ids satisfy the content contract's MediaId", () => {
  assert.ok(MediaId.safeParse(crypto.randomUUID()).success);
});
