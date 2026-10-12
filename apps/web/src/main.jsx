import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
/* Before App: in a runtime-snapshot build this module awaits the API's
   latest published snapshot at the top level, and every content module
   App imports waits for that decision (src/lib/runtimeBoot.js). In any
   other build it only notes whether the page was pre-rendered. */
import { mountDecision } from "./lib/runtimeBoot.js";
import App from "./App.jsx";

/* The page arrives pre-rendered (scripts/prerender.mjs, Document 15):
   #root already holds this route's HTML, and `data-route` names the route
   it was rendered for. When that is the route the browser is on — and the
   content loaded is the content it was rendered from — React HYDRATES
   it: takes over the existing DOM without redrawing it. When it is not —
   404.html answering an unknown address, the dev server's empty shell, or
   a newer published snapshot than the one the HTML was rendered from —
   React renders from scratch instead, so a page is never hydrated against
   markup made for a different URL or different content. */
const root = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const mode = mountDecision();
if (mode === "hydrate") {
  ReactDOM.hydrateRoot(root, app);
} else if (mode === "render") {
  root.textContent = "";
  ReactDOM.createRoot(root).render(app);
}
/* "reloading": the page is reloading without the runtime snapshot. */
