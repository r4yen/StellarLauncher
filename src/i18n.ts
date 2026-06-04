import { LauncherSettings } from "./models/settings";

export type Language = LauncherSettings["language"];

const translations = {
  en: {
    home: "Home",
    instances: "Instances",
    accounts: "Accounts",
    theme: "Theme",
    settings: "Settings",
    localMode: "Local mode",
    languageEnglish: "English",
    languageGerman: "Deutsch",
    launch: "Launch",
    stop: "Stop",
    newInstance: "New Instance",
    microsoftLogin: "Microsoft Login",
    openMicrosoft: "Open Microsoft",
    addOfflinePlayer: "Add Offline Player",
    delete: "Delete",
    favorite: "Favorite",
    unfavorite: "Unfavorite",
    mods: "Mods"
  },
  de: {
    home: "Start",
    instances: "Instanzen",
    accounts: "Accounts",
    theme: "Design",
    settings: "Einstellungen",
    localMode: "Lokaler Modus",
    languageEnglish: "English",
    languageGerman: "Deutsch",
    launch: "Starten",
    stop: "Stoppen",
    newInstance: "Neue Instanz",
    microsoftLogin: "Microsoft Login",
    openMicrosoft: "Microsoft öffnen",
    addOfflinePlayer: "Offline-Spieler hinzufügen",
    delete: "Löschen",
    favorite: "Favorit",
    unfavorite: "Favorit entfernen",
    mods: "Mods"
  }
} as const;

export function t(language: Language, key: keyof typeof translations.en): string {
  return translations[language][key] ?? translations.en[key];
}
