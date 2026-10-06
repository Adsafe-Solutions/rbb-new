# @rbb/forms

**Boundary only (M0). No code yet.**

Will hold the form schema shared by the browser and the server: today's
`apps/web/src/lib/formSchema.js`, which `apps/web/server/handler.mjs`
already imports across the client/server line.

Moves here when the form endpoint is extracted into `apps/api` (**M2**).
It stays where it is until then, so the web build is unchanged.
