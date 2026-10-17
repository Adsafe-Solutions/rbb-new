import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { SAVED_SNAPSHOT, applySnapshot } from "./support/saved-snapshot.mjs";

/* Event registration on the event's own page (2026-10-17): the saved live
   snapshot with a registration form given — in memory only — to one of
   its events, rendered as the pre-render renders it; plus the browser's
   checks for the field types the form brings (radio, checkboxes, number,
   date), which must agree with the API's (apps/api forms definition.ts). */

const root = fileURLToPath(new URL("../..", import.meta.url));
const FIELDS = [
  { id: "name", type: "text", label: "Your full name", required: true, maxLength: 200 },
  { id: "email", type: "email", label: "Email address", required: true, maxLength: 254 },
  { id: "meal", type: "radio", label: "Meal", required: true, options: ["Vegetarian", "Vegan"] },
  { id: "sessions", type: "checkboxes", label: "Sessions", required: false, options: ["Morning", "Afternoon"] },
  { id: "guest_count", type: "number", label: "Guests", required: false, min: 0, max: 4 },
  { id: "arrival_date", type: "date", label: "Arrival", required: false },
  { id: "marketing", type: "checkbox", label: "News by email", required: false, defaultChecked: true },
];

const snapshot = structuredClone(SAVED_SNAPSHOT);
const [withForm, other] = snapshot.content.events;
withForm.registrationUrl = undefined;
withForm.registration = { open: true, capacity: 30, submitLabel: "Save my place", successMessage: "You're registered.", fields: FIELDS };

let vite, render, forms, lib;
before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, then the snapshot applied by hand (see
     stories-projects-render.test.mjs for why RBB_SNAPSHOT=off). */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  await applySnapshot(vite, snapshot);
  forms = await vite.ssrLoadModule("/src/content/forms.js");
  lib = await vite.ssrLoadModule("/src/lib/forms.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const media = async () => vite.ssrLoadModule("/src/content/media.js");

test("the config: the event's own form, posting to event-<record id>, with the site's error, full and closed lines", async () => {
  const event = (await media()).eventById(withForm.slug);
  const config = forms.eventRegistrationConfig(event);
  assert.equal(config.formId, `event-${withForm.id}`);
  assert.match(config.endpoint ?? "", new RegExp(`/event-${withForm.id}$`), "the Contact endpoint's route, with this form's id");
  assert.equal(config.submitLabel, "Save my place");
  assert.equal(config.successMessage, "You're registered.");
  for (const key of ["errorMessage", "fullMessage", "closedMessage"]) assert.ok(config[key], key);
  const byName = Object.fromEntries(config.fields.map((f) => [f.name, f]));
  assert.deepEqual(byName.meal.options, [{ value: "Vegetarian", label: "Vegetarian" }, { value: "Vegan", label: "Vegan" }]);
  assert.deepEqual([byName.guest_count.min, byName.guest_count.max], [0, 4]);
  assert.equal(lib.formState(config), "ready", "an endpoint and the published Privacy Policy: drawn");
  assert.equal(forms.eventRegistrationConfig((await media()).eventById(other.slug)), null, "no registration: no form");
});

test("rendered: the Register section with the form, places limited, and the facts card's button jumping to it", () => {
  const page = main(render(`/media/events/${withForm.slug}`).html);
  assert.match(page, /<section id="register"/);
  assert.match(page, new RegExp(`data-form="event-${withForm.id}"`));
  const words = text(page);
  assert.match(words, /Places are limited\./);
  assert.match(words, /Save my place/);
  assert.match(page, /href="[^"]*#register"/, "the facts card's Register button");
  assert.match(page, /<fieldset[^>]*>\s*<legend/, "a choice field is a fieldset with a legend");
  assert.match(page, /type="radio"[^>]*name="meal"|name="meal"[^>]*type="radio"/);
  assert.match(page, /type="number"/);
  assert.match(page, /type="date"/);
  assert.match(page, new RegExp(`id="event-${withForm.id}-meal"`), "the group's first option carries the field's id (the error summary links to it)");

  const plain = main(render(`/media/events/${other.slug}`).html);
  assert.doesNotMatch(plain, /id="register"/, "an event without a form has no Register section");
});

test("checks: choose one, choose any (an array), whole numbers within range, real dates — and the server's codes for them", () => {
  const field = (name) => forms.eventRegistrationConfig({ registration: { formId: "event-x", submitLabel: "Go", successMessage: "Done.", fields: FIELDS } }).fields.find((f) => f.name === name);
  const m = forms.FORM_COPY.messages;
  const meal = field("meal");
  assert.equal(lib.validateField(meal, ""), m.choose("Meal"));
  assert.equal(lib.validateField(meal, "Vegan"), null);
  assert.equal(lib.validateField(meal, "Fish"), m.choose("Meal"));

  const sessions = field("sessions");
  assert.equal(lib.validateField(sessions, undefined), null, "optional, nothing chosen");
  assert.equal(lib.validateField(sessions, []), null);
  assert.equal(lib.validateField(sessions, ["Morning", "Afternoon"]), null);
  assert.equal(lib.validateField(sessions, ["Evening"]), m.invalid("Sessions"));
  assert.equal(lib.validateField({ ...sessions, required: true }, []), m.chooseAny("Sessions"));

  const guests = field("guest_count");
  assert.equal(lib.validateField(guests, ""), null);
  assert.equal(lib.validateField(guests, "3"), null);
  assert.equal(lib.validateField(guests, "2.5"), m.number("Guests"));
  assert.equal(lib.validateField(guests, "5"), m.numberRange("Guests", 0, 4));
  assert.equal(lib.validateField(guests, "-1"), m.numberRange("Guests", 0, 4));

  const arrival = field("arrival_date");
  assert.equal(lib.validateField(arrival, "2026-11-14"), null);
  assert.equal(lib.validateField(arrival, "2026-02-30"), m.date("Arrival"));
  assert.equal(lib.validateField(arrival, "14/11/2026"), m.date("Arrival"));

  assert.equal(lib.serverFieldMessage(guests, "invalid"), m.numberRange("Guests", 0, 4));
  assert.equal(lib.serverFieldMessage(guests, "format"), m.number("Guests"));
  assert.equal(lib.serverFieldMessage(arrival, "format"), m.date("Arrival"));
  assert.equal(lib.serverFieldMessage({ ...sessions, required: true }, "required"), m.chooseAny("Sessions"));
  assert.equal(lib.serverFieldMessage(meal, "required"), m.choose("Meal"));
});
