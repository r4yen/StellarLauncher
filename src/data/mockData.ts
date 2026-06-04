import { Account } from "../models/account";
import { Instance } from "../models/instance";
import { LauncherSettings, LauncherStatusSummary, ThemeSettings } from "../models/settings";

export const mockInstances: Instance[] = [];

export const mockAccounts: Account[] = [];

export const defaultThemeSettings: ThemeSettings = {
  accentColor: "#39d5ff"
};

export const defaultLauncherSettings: LauncherSettings = {
  javaPath: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe",
  java8Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-8\\bin\\java.exe",
  java17Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe",
  java21Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe",
  java25Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-25\\bin\\java.exe",
  defaultRamMb: 6144,
  gameDirectory: "%APPDATA%\\.minecraft",
  jvmArgs: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions",
  launcherFolder: "%APPDATA%\\StellarLauncher",
  minecraftStorageDirectory: "%APPDATA%\\StellarLauncher\\minecraft",
  language: "en"
};

export const defaultLauncherStatus: LauncherStatusSummary = {
  version: "1.0.1",
  javaDetected: true,
  storageReady: true,
  lastSync: "Local mock mode"
};
