import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIGURE_LABEL_MAX, FIGURE_VALUE_MAX, IMPACT_FIGURES_MAX, LOCATION_MAX, PARTNERS_MAX, PARTNER_MAX, STAGE_MAX, figureProblems, partnerProblems } from "../../src/content/projectFields.ts";
import { PROJECT_IMPACT_MAX, PROJECT_PARTNERS_MAX, Project } from "../../../../packages/content-schema/src/index.ts";

/* Milestone 6: the project editor's facts, impact figures, partners and
   story. The helpers mirror the contract; the contract (and the API) stay
   the rule. */

const base = { id: "p", orgId: "rbb", schemaVersion: 1, status: "draft", slug: "p", title: "P", programId: "education", description: "D.", order: 0 };
const issues = (extra) => {
  const r = Project.safeParse({ ...base, ...extra });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

test("limits are the contract's", () => {
  assert.deepEqual([IMPACT_FIGURES_MAX, PARTNERS_MAX], [PROJECT_IMPACT_MAX, PROJECT_PARTNERS_MAX]);
  for (const [field, max] of [["location", LOCATION_MAX], ["stage", STAGE_MAX]]) assert.deepEqual([issues({ [field]: "x".repeat(max) }), issues({ [field]: "x".repeat(max + 1) })], [[], [field]], field);
  assert.deepEqual(issues({ impact: [{ value: "x".repeat(FIGURE_VALUE_MAX), label: "y".repeat(FIGURE_LABEL_MAX) }] }), []);
  assert.deepEqual(issues({ impact: [{ value: "x".repeat(FIGURE_VALUE_MAX + 1), label: "y".repeat(FIGURE_LABEL_MAX + 1) }] }), ["impact.0.value", "impact.0.label"]);
  assert.deepEqual([issues({ partners: ["x".repeat(PARTNER_MAX)] }), issues({ partners: ["x".repeat(PARTNER_MAX + 1)] })], [[], ["partners.0"]]);
});

test("figure and partner problems agree with the contract, case for case", () => {
  for (const impact of [
    [{ value: "120", label: "Children" }],
    [{ value: "120", label: "Children" }, { value: "12", label: "Schools" }],
    [{ value: "", label: "Children" }],
    [{ value: "120", label: " " }],
    [{ value: "120", label: "Children" }, { value: "120", label: "Children" }],
  ]) {
    const contract = new Set(issues({ impact }).map((p) => p.split(".").slice(1, 3).join(".").replace(/^(\d+)$/, "$1.value")));
    const mirrored = new Set([...figureProblems(impact)].flatMap(([i, p]) => [p.value && `${i}.value`, p.label && `${i}.label`].filter(Boolean)));
    assert.deepEqual(mirrored, contract, JSON.stringify(impact));
  }
  for (const partners of [["A school"], ["A school", "A library"], [""], ["  "], ["A school", "A school"]]) {
    const contract = new Set(issues({ partners }).map((p) => Number(p.split(".")[1])));
    assert.deepEqual(new Set(partnerProblems(partners).keys()), contract, JSON.stringify(partners));
  }
});

test("the project editor offers every field and sends it; the story is chosen by id", () => {
  const editor = readFileSync(new URL("../../src/pages/projects/ProjectEditorPage.tsx", import.meta.url), "utf8");
  assert.match(editor, /const FIELDS = \[[^\]]*"location", "stage", "date", "impact", "partners", "storyId"/);
  for (const label of ["Location", "Stage", "Date", "Impact figures", "Partners"]) assert.match(editor, new RegExp(`label="${label}"`), label);
  assert.match(editor, /editor\.set\(\{ impact: listOrNone\(next\) \}\)/, "an emptied list is cleared");
  assert.match(editor, /editor\.set\(\{ partners: listOrNone\(next\) \}\)/);
  assert.match(editor, /<StorySelect value=\{d\.storyId\} onChange=\{\(storyId\) => editor\.set\(\{ storyId \}\)\}/);
  const pickers = readFileSync(new URL("../../src/content/pickers.tsx", import.meta.url), "utf8");
  assert.match(pickers, /value: v\.record\.id, label: v\.record\.title/, "a story is stored by its id, shown by its title");
  assert.match(pickers, /status !== "archived"/, "an archived story is never offered");
});
