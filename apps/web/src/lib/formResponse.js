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
const NAME = /^[a-z][a-zA-Z]{0,30}$/;

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
