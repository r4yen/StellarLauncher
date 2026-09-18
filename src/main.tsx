import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import { loadTheme } from "./services/storageService";
import { defaultThemeSettings } from "./data/mockData";

async function start() {
  const loaded = await loadTheme(defaultThemeSettings).catch(() => defaultThemeSettings);
  const theme = loaded && /^#[\da-f]{6}$/i.test(loaded.accentColor) ? loaded : defaultThemeSettings;
  document.documentElement.style.setProperty("--accent", theme.accentColor);
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode><App initialTheme={theme}/></React.StrictMode>
  );
  document.documentElement.removeAttribute("data-booting");
}
void start();
