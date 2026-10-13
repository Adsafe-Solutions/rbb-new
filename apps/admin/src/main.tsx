import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, setThemeMode } from "./design-system";
import { theme } from "./theme";
import { preferredMode } from "./theme/mode";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html");

// The brand layer goes onto <html> before anything renders, then the
// light or dark mode this browser last chose (the config's default otherwise).
applyTheme(theme);
setThemeMode(preferredMode());

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
