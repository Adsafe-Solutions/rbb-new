# @rbb/forms

The form domain: one definition of what each form accepts and how a
submission is checked, shared by every app that touches a form.

| Export | What |
|---|---|
| `@rbb/forms/schema` | `FORM_SCHEMA` (fields per form), `FIELD_RULES`, `TOPICS`, `EMAIL_PATTERN`, `HONEYPOT_FIELD`, `MIN_FILL_MS`, `MAX_BODY_BYTES`. Plain data, safe for the browser bundle |
| `@rbb/forms` | All of the above plus `validateSubmission(body)` and `CONTROL` |

`validateSubmission` returns `{ ok: true, formId, data }` or
`{ ok: false, status, error, fields? }`. `fields` holds short codes
(`required`, `format`, `too-long`, `invalid`), never what the visitor typed.

The package is plain JavaScript ESM with no dependencies. The JavaScript web
app (its browser bundle and its Node form endpoint) and the TypeScript API
can all load it without a build step.

## Consumers today

- `apps/web/src/lib/formSchema.js` re-exports `@rbb/forms/schema` for the
  site's form components and content.
- `apps/api/src/modules/forms/` (M18): the form endpoint,
  `POST /api/v1/forms/:formId`. It imports `validateSubmission` and the
  anti-spam constants. TypeScript types are in `src/*.d.ts`; keep them in
  step with the JavaScript.
- `apps/web/server/handler.mjs`: the previous endpoint. It stays until a
  separate, reviewed change retires it.

The HTTP handling, rate limiting and Resend email for the forms live in
`apps/api` (see its README, "Public forms").

Never here: React components, HTTP handlers, storage, email delivery.
