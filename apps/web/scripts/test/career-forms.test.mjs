import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { newCareerForm } from "@rbb/content-schema";
import { SAVED_SNAPSHOT, applySnapshot } from "./support/saved-snapshot.mjs";

/* Careers after review (2026-10-17): every open role takes applications.
   A role whose form was saved in the admin keeps it; a role added later,
   with no saved form, gets the standard application form named for it —
   before, only "Sr. Software Engineer" (the one saved form) had an Apply
   section, which read as hard-coded. The standard form is the admin's own
   starting point (content-schema newCareerForm), and the API accepts it
   for any published role (apps/api test/career-applications.test.ts). */

const root = fileURLToPath(new URL("../..", import.meta.url));
const NEW_ROLE = { id: "field-coordinator", title: "Field Coordinator" };

const snapshot = structuredClone(SAVED_SNAPSHOT);
snapshot.content.careers.opportunities.roles = [...snapshot.content.careers.opportunities.roles, NEW_ROLE];

let vite, render, forms;
before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, then the snapshot applied by hand (see
     stories-projects-render.test.mjs for why RBB_SNAPSHOT=off). */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  await applySnapshot(vite, snapshot);
  forms = await vite.ssrLoadModule("/src/content/forms.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));

test("the website's standard career form is the admin's own starting point, field for field", () => {
  for (const role of [NEW_ROLE, { id: "x", title: "A".repeat(200) }]) assert.deepEqual(forms.defaultCareerForm(role), newCareerForm(role.id, role.title));
});

test("a saved form is kept; a role without one gets the standard form, posting to its own career-<role id>", () => {
  const saved = forms.careerFormConfig({ id: "sr-software-engineer", title: "Sr. Software Engineer" });
  assert.equal(saved.heading, snapshot.content.forms.find((f) => f.id === "career-sr-software-engineer").heading);
  const standard = forms.careerFormConfig(NEW_ROLE);
  assert.equal(standard.formId, "career-field-coordinator");
  assert.equal(standard.heading, "Apply for Field Coordinator");
  assert.match(standard.endpoint ?? "", /\/career-field-coordinator$/);
  assert.deepEqual(standard.fields.map((f) => f.name), ["name", "email", "cv", "message", "marketing"]);
  assert.equal(forms.careerFormConfig({ title: "A role with no id" }), null);
});

test("the Careers page: every open role says 'apply below' and has its own Apply section", () => {
  const page = main(render("/about-us/careers").html);
  for (const role of ["sr-software-engineer", NEW_ROLE.id]) assert.match(page, new RegExp(`id="apply-${role}"`), role);
  assert.match(page, /Field Coordinator — apply below/);
  assert.match(page, /Sr\. Software Engineer — apply below/);
  assert.match(page, /data-form="career-field-coordinator"/);
});
