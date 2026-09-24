/* Error reporting — Document 17. A no-op until RBB approves an error
   monitoring provider and its data scope (config/observability.js).

   What may ever be sent is fixed here, not by the provider: a technical
   CATEGORY and the canonical ROUTE ("/stories", never a query string).
   Never the error message or stack — either can carry what a visitor
   typed — and never form contents, request bodies, headers, cookies or
   tokens. A provider's public identifier may be configured; its secret
   credentials never reach the browser. */
import { OBSERVABILITY, streamEnabled } from "../config/observability.js";

/* Provider adapters — none. ADAPTERS.<provider> = { report({ category, route }) } */
const ADAPTERS = {};

export function reportError(category, route) {
  if (!streamEnabled("errors")) return;
  const adapter = ADAPTERS[OBSERVABILITY.errors.provider];
  adapter?.report({
    category: String(category).slice(0, 40),
    route: String(route).split(/[?#]/)[0],
  });
}

export default reportError;
