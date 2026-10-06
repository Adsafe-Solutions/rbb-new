# @rbb/money

**Boundary only (M0). No code yet.**

Will hold integer minor-unit money arithmetic shared by the donation form and
server-side payment code: today's `apps/web/src/lib/money.js`, which was
written to be shared ("so a payment provider's server code can share it
later").

Moves here when server-side donation code first needs it. It stays where it
is until then, so the web build is unchanged.
