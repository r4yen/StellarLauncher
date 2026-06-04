import { LauncherSettings, ThemeSettings } from "../models/settings";

const themeKey = "stellarlauncher.theme";
const settingsKey = "stellarlauncher.settings";

export function loadStoredValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveStoredValue<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadThemeSettings(fallback: ThemeSettings): ThemeSettings {
  return loadStoredValue(themeKey, fallback);
}

export function saveThemeSettings(theme: ThemeSettings): void {
  saveStoredValue(themeKey, theme);
}

export function loadLauncherSettings(fallback: LauncherSettings): LauncherSettings {
  return loadStoredValue(settingsKey, fallback);
}

export function saveLauncherSettings(settings: LauncherSettings): void {
  saveStoredValue(settingsKey, settings);
}
