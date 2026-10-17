/* @rbb/forms — the form domain, shared by every app that touches a form:
   what each form accepts (./schema.js) and the server-side check of a
   submission (./validate.js). Plain JavaScript ESM with no outside imports
   and no runtime APIs, so the browser build, Node and the API load it as-is.

   Never here: React components, HTTP handlers, storage, email delivery. */
export * from "./schema.js";
export { CONTROL, validateSubmission } from "./validate.js";
