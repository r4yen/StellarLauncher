import { Account, Instance, LauncherSettings, LauncherStatusSummary, ThemeSettings } from "../models/launcher";

export const mockInstances: Instance[] = [
  {
    id: "stellar-survival",
    name: "Stellar Survival",
    version: "1.21.1",
    modloader: "Fabric",
    path: "D:\\Games\\Minecraft\\Instances\\Stellar Survival",
    lastLaunch: "2026-06-02 21:18",
    ramMb: 6144,
    notes: "Performance mods, shaders and a lightweight exploration pack."
  },
  {
    id: "deep-tech",
    name: "Deep Tech Labs",
    version: "1.20.1",
    modloader: "Forge",
    path: "D:\\Games\\Minecraft\\Instances\\Deep Tech Labs",
    lastLaunch: "2026-05-30 18:44",
    ramMb: 8192,
    notes: "Automation-heavy profile for long-running worlds."
  },
  {
    id: "vanilla-latest",
    name: "Vanilla Latest",
    version: "1.21.5",
    modloader: "Vanilla",
    path: "D:\\Games\\Minecraft\\Instances\\Vanilla Latest",
    lastLaunch: "2026-05-21 16:10",
    ramMb: 4096,
    notes: "Clean client for snapshots, realms and compatibility checks."
  }
];

export const mockAccounts: Account[] = [
  {
    id: "account-ray",
    username: "Rayen",
    type: "microsoft",
    avatarColor: "#22d3ee",
    lastUsed: "2026-06-02",
    isActive: true
  },
  {
    id: "account-builder",
    username: "StellarBuilder",
    type: "offline",
    avatarColor: "#a855f7",
    lastUsed: "2026-05-25",
    isActive: false
  }
];

export const defaultThemeSettings: ThemeSettings = {
  accentColor: "#39d5ff",
  glowIntensity: 58,
  compactMode: false
};

export const defaultLauncherSettings: LauncherSettings = {
  javaPath: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe",
  defaultRamMb: 6144,
  gameDirectory: "%APPDATA%\\.minecraft",
  jvmArgs: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions",
  launcherFolder: "%APPDATA%\\StellarLauncher"
};

export const defaultLauncherStatus: LauncherStatusSummary = {
  version: "0.1.0",
  javaDetected: true,
  storageReady: true,
  lastSync: "Local mock mode"
};
