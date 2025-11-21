import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./config/ThemeContext";
import { UiSettingsProvider } from "./config/UiSettingsContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <UiSettingsProvider>
        <App />
      </UiSettingsProvider>
    </ThemeProvider>
  </StrictMode>
);
