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
- `apps/web/server/handler.mjs`, the live form endpoint, imports
  `validateSubmission`.

The endpoint itself (HTTP, anti-spam timing, rate limiting, email through
Resend) still lives in `apps/web/server`. Moving it into `apps/api` depends on
where the site is hosted, because the site posts to its own `/api/forms`. See
`apps/api/README.md`.

Never here: React components, HTTP handlers, storage, email delivery.
