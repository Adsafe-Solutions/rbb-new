import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { nextSeo } from "../../src/content/seo.ts";

/* Milestone 3: the editors' sharing metadata. `seo` is one field: what the
   editor leaves out is not set; empty text and no image are left out;
   noIndex is stored only when true; nothing set → no `seo` at all. */

test("setting, keeping and clearing fields", () => {
  assert.deepEqual(nextSeo(undefined, { title: "A title" }), { title: "A title" });
  assert.deepEqual(nextSeo({ title: "A title", ogImageId: "img-1" }, { description: "A line." }), { title: "A title", ogImageId: "img-1", description: "A line." }, "other fields kept");
  assert.deepEqual(nextSeo({ title: "A title", ogImageId: "img-1" }, { ogImageId: undefined }), { title: "A title" }, "removing the image clears just it");
  assert.deepEqual(nextSeo({ title: "A title" }, { title: "" }), undefined, "nothing left → no seo at all");
});

test("noIndex: true is stored; unticking removes it — never stored as false", () => {
  assert.deepEqual(nextSeo({ title: "A title" }, { noIndex: true }), { title: "A title", noIndex: true });
  assert.deepEqual(nextSeo({ title: "A title", noIndex: true }, { noIndex: undefined }), { title: "A title" });
  assert.deepEqual(nextSeo({ title: "A title", noIndex: true }, { noIndex: false }), { title: "A title" });
  assert.deepEqual(nextSeo({ noIndex: true }, { noIndex: undefined }), undefined);
  assert.deepEqual(nextSeo({ title: "A title", noIndex: false }, {}), { title: "A title" }, "a stored false is tidied away");
});

test("every editor with sharing fields offers 'keep out of search engines' and uses the shared rules", () => {
  const src = fileURLToPath(new URL("../../src", import.meta.url));
  const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith(".tsx") ? [join(dir, f)] : []));
  const editors = files(src).filter((f) => readFileSync(f, "utf8").includes('label="SEO title"'));
  assert.equal(editors.length, 9, editors.join(", "));
  for (const file of editors) {
    const text = readFileSync(file, "utf8");
    const name = file.slice(src.length + 1);
    assert.match(text, /<NoIndexField value=\{seo\.noIndex\} onChange=\{\(noIndex\) => setSeo\(\{ noIndex \}\)\}/, `${name}: the control`);
    assert.match(text, /const next = nextSeo\(seo, changes\);/, `${name}: the shared rules`);
    if (!name.includes("careers")) assert.match(text, /label="Social image"/, `${name}: a social image`);
  }
});
