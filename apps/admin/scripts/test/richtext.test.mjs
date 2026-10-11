import { test } from "node:test";
import assert from "node:assert/strict";
import { fromEditable, parseInline, serializeInline, toEditable, unsafeLinks } from "../../src/content/richtext.ts";

/* The admin's rich-text form ↔ the content contract's RichText JSON. */

const t = (text, marks) => (marks ? { type: "text", text, marks } : { type: "text", text });

test("inline markup → contract nodes", () => {
  assert.deepEqual(parseInline("Plain"), [t("Plain")]);
  assert.deepEqual(parseInline("a **bold** and *italic* and ***both***"), [t("a "), t("bold", ["bold"]), t(" and "), t("italic", ["italic"]), t(" and "), t("both", ["bold", "italic"])]);
  assert.deepEqual(parseInline("see [our *work*](/work) now"), [t("see "), { type: "link", href: "/work", children: [t("our "), t("work", ["italic"])] }, t(" now")]);
  assert.deepEqual(parseInline("2 * 3 and a lone **"), [t("2 * 3 and a lone **")], "unclosed fences stay literal");
  assert.deepEqual(parseInline("\\*not italic\\* and \\[not a link\\](x)"), [t("*not italic* and [not a link](x)")]);
  assert.deepEqual(parseInline("[broken link](has space)"), [t("[broken link](has space)")]);
  assert.deepEqual(parseInline(""), []);
});

test("serialize ∘ parse is the identity on contract content", () => {
  const docs = [
    [t("a "), t("b", ["bold"]), t(" c")],
    [t("costs 2*3 [sic] (approx) \\ done")],
    [{ type: "link", href: "https://example.org/a(b)", children: [t("x", ["bold", "italic"])] }],
    [t("x", ["italic"]), t("y", ["bold"])],
  ];
  for (const nodes of docs) assert.deepEqual(parseInline(serializeInline(nodes)), nodes, serializeInline(nodes));
});

test("blocks ↔ RichText, with empty blocks and lines dropped", () => {
  const doc = [
    { type: "heading", level: 2, children: [t("Title")] },
    { type: "paragraph", children: [t("Body "), t("text", ["bold"])] },
    { type: "list", style: "ordered", items: [[t("One")], [t("Two")]] },
    { type: "list", style: "bullet", items: [[t("A")]] },
  ];
  assert.deepEqual(fromEditable(toEditable(doc)), doc);
  assert.deepEqual(fromEditable([{ kind: "paragraph", text: "  " }, { kind: "bullet", text: "\n\n" }, { kind: "heading3", text: "H" }]), [{ type: "heading", level: 3, children: [t("H")] }]);
  assert.deepEqual(toEditable(undefined), [{ kind: "paragraph", text: "" }]);
});

test("output is only what the contract defines — never HTML", () => {
  const doc = fromEditable([{ kind: "paragraph", text: "<script>alert(1)</script> <b>x</b>" }]);
  assert.deepEqual(doc, [{ type: "paragraph", children: [t("<script>alert(1)</script> <b>x</b>")] }], "markup is just text");
  assert.deepEqual(unsafeLinks(fromEditable([{ kind: "paragraph", text: "[x](javascript:alert(1)) [y](http://insecure.example) [ok](https://ok.example) [p](/page)" }])), ["http://insecure.example"]);
});
