export interface ThemeSettings {
  accentColor: string;
}

export interface LauncherSettings {
  java8Path: string;
  java17Path: string;
  java21Path: string;
  java25Path: string;
  defaultRamMb: number;
  gameDirectory: string;
  jvmArgs: string;
  launcherFolder: string;
  minecraftStorageDirectory: string;
  language: "en" | "de";
  discordRichPresenceEnabled: boolean;
}

export interface LauncherStatusSummary {
  version: string;
  javaDetected: boolean;
  storageReady: boolean;
  lastSync: string;
}
