/* The field codes in a 422 answer from a form endpoint — Document 21.
   Pure, no imports, so it is unit-tested under plain Node
   (scripts/test/form-response.test.mjs).

   Two shapes are understood:
     - the API's (M18):  { error: { code, details: [{ path: "fields.<name>", message: "<code>" }] } }
     - the website's own form server (apps/web/server, being retired):
                          { ok: false, fields: { <name>: "<code>" } }

   Only known codes and plain field names come through. Never wording: the
   form shows its own message for each code (lib/forms.js
   serverFieldMessage). */
const CODES = new Set(["required", "format", "too-long", "invalid"]);
/* A field name: the built-in forms' camelCase, and the ids the admin
   gives a field it builds (packages/content-schema FormFieldId — lowercase
   letters, digits and "_"). It used to be letters only, and a server error
   on an admin-built field like "dietary_needs" or "guest2" was dropped,
   leaving the visitor with no message. Still never "__proto__": a name
   starts with a letter. */
const NAME = /^[a-z][a-zA-Z0-9_]{0,39}$/;

export function fieldCodesFrom(body) {
  const fields = {};
  const add = (name, code) => {
    if (typeof name === "string" && NAME.test(name) && CODES.has(code)) fields[name] = code;
  };
  const details = body?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const match = /^fields\.(.+)$/.exec(typeof detail?.path === "string" ? detail.path : "");
      if (match) add(match[1], detail.message);
    }
  } else if (body?.fields && typeof body.fields === "object" && !Array.isArray(body.fields)) {
    for (const [name, code] of Object.entries(body.fields)) add(name, code);
  }
  return fields;
}

/* A 409 from an event's registration form (2026-10-17): the API's
   envelope names why in `details` — { path: "registration", message:
   "full" | "closed" }. Anything else is an ordinary error. */
export function registrationOutcome(body) {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return "error";
  const reason = details.find((d) => d?.path === "registration")?.message;
  return reason === "full" || reason === "closed" ? reason : "error";
}
