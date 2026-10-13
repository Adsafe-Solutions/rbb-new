import { test } from "node:test";
import assert from "node:assert/strict";

/* Media (2026-10-13): images are converted to WebP before upload, and a
   file nothing uses can be deleted. The browser encoding itself is
   checked in a browser; these are its rules. */

test("optimise: scale only above 3200px on the longest side, keeping the shape", async () => {
  const { targetSize, MAX_EDGE } = await import("../../src/media/convert.ts");
  assert.equal(MAX_EDGE, 3200);
  assert.deepEqual(targetSize(1600, 1200), { width: 1600, height: 1200, scaled: false });
  assert.deepEqual(targetSize(3200, 2000), { width: 3200, height: 2000, scaled: false });
  assert.deepEqual(targetSize(6000, 4000), { width: 3200, height: 2133, scaled: true });
  assert.deepEqual(targetSize(3000, 9000), { width: 1067, height: 3200, scaled: true });
});

test("optimise: WebP name and quality; the WebP is used only when it helps", async () => {
  const { webpName, qualityFor, useConverted, convertible } = await import("../../src/media/convert.ts");
  assert.equal(webpName("Field Day.JPG"), "Field Day.webp");
  assert.equal(webpName("logo.png"), "logo.webp");
  assert.equal(webpName("noext"), "noext.webp");
  assert.equal(qualityFor("image/png"), 0.9);
  assert.equal(qualityFor("image/jpeg"), 0.85);
  assert.equal(useConverted(1000, 400, false, "image/jpeg"), true);
  assert.equal(useConverted(1000, 1200, false, "image/jpeg"), false, "bigger: keep the original");
  assert.equal(useConverted(1000, 1200, true, "image/jpeg"), true, "scaled down: always the WebP");
  assert.equal(useConverted(1000, 950, false, "image/webp"), false, "a WebP is re-encoded only for 10%+");
  assert.equal(useConverted(1000, 850, false, "image/webp"), true);
  const file = (type, size = 10) => ({ type, size });
  assert.equal(convertible(file("image/jpeg")), true);
  assert.equal(convertible(file("image/gif")), true);
  assert.equal(convertible(file("image/svg+xml")), false, "never SVG");
  assert.equal(convertible(file("application/pdf")), false);
  assert.equal(convertible(file("image/png", 0)), false);
  assert.equal(convertible(file("image/png", 61 * 1024 * 1024)), false);
});

test("delete: offered for a ready image nothing uses, never for one in use or of unknown use", async () => {
  const { deletable } = await import("../../src/media/usage.ts");
  assert.equal(deletable({ status: "ready", usedBy: [] }), true);
  assert.equal(deletable({ status: "ready", usedBy: ["The live website (published version 54)"] }), false);
  assert.equal(deletable({ status: "ready" }), false);
  assert.equal(deletable({ status: "failed" }), true);
  assert.equal(deletable({ status: "pending" }, true), false, "still uploading");
});
