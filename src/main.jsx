import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App.jsx";

/* The page arrives pre-rendered (scripts/prerender.mjs, Document 15):
   #root already holds this route's HTML, and `data-route` names the route
   it was rendered for. When that is the route the browser is on, React
   HYDRATES it — takes over the existing DOM without redrawing it. When it
   is not — 404.html answering an unknown address, or the dev server's
   empty shell — React renders from scratch instead, so a page is never
   hydrated against markup made for a different URL. */
/* The deferred stylesheet (index.html, `data-deferred-style`): loaded as
   `media="print"` so it never blocks rendering, switched on here. Done in
   the bundle, not in an inline onload handler, which the Content Security
   Policy forbids (Document 20). */
for (const link of document.querySelectorAll("link[data-deferred-style]"))
  link.media = "all";

const root = document.getElementById("root");
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (root.dataset.route === path && root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, app);
} else {
  root.textContent = "";
  ReactDOM.createRoot(root).render(app);
}
