import { Account } from "../models/account";
import { Instance } from "../models/instance";
import { LauncherSettings, LauncherStatusSummary, ThemeSettings } from "../models/settings";

export const mockInstances: Instance[] = [];

export const mockAccounts: Account[] = [];

export const defaultThemeSettings: ThemeSettings = {
  accentColor: "#39d5ff"
};

const isLinux = typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent);
const defaultPaths = isLinux
  ? {
      java8Path: "/usr/lib/jvm/java-8-openjdk/bin/java",
      java17Path: "/usr/lib/jvm/java-17-openjdk/bin/java",
      java21Path: "/usr/lib/jvm/java-21-openjdk/bin/java",
      java25Path: "/usr/lib/jvm/java-25-openjdk/bin/java",
      gameDirectory: "$HOME/.minecraft",
      launcherFolder: "$HOME/.local/share/StellarLauncher",
      minecraftStorageDirectory: "$HOME/.local/share/StellarLauncher/minecraft"
    }
  : {
      java8Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-8\\bin\\java.exe",
      java17Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe",
      java21Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe",
      java25Path: "C:\\Program Files\\Eclipse Adoptium\\jdk-25\\bin\\java.exe",
      gameDirectory: "%APPDATA%\\.minecraft",
      launcherFolder: "%APPDATA%\\StellarLauncher",
      minecraftStorageDirectory: "%APPDATA%\\StellarLauncher\\minecraft"
    };

export const defaultLauncherSettings: LauncherSettings = {
  java8Path: defaultPaths.java8Path,
  java17Path: defaultPaths.java17Path,
  java21Path: defaultPaths.java21Path,
  java25Path: defaultPaths.java25Path,
  defaultRamMb: 6144,
  gameDirectory: defaultPaths.gameDirectory,
  jvmArgs: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions",
  launcherFolder: defaultPaths.launcherFolder,
  minecraftStorageDirectory: defaultPaths.minecraftStorageDirectory,
  language: "en",
  discordRichPresenceEnabled: true
};

export const defaultLauncherStatus: LauncherStatusSummary = {
  version: "1.0.3",
  javaDetected: true,
  storageReady: true,
  lastSync: "Local mock mode"
};
