import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "./design-system";
import { theme } from "./theme";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html");

// The brand layer goes onto <html> before anything renders.
applyTheme(theme);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
