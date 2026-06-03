export type PageKey = "home" | "instances" | "accounts" | "theme" | "settings";

export type LaunchState = "idle" | "preparing" | "launching" | "running" | "error";

export interface LaunchStatus {
  state: LaunchState;
  message: string;
  instanceId?: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  username: string;
  type: "microsoft" | "offline";
  avatarColor: string;
  lastUsed: string;
  isActive: boolean;
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  modloader: "Vanilla" | "Fabric" | "Forge" | "Quilt" | "NeoForge";
  path: string;
  lastLaunch: string;
  ramMb: number;
  notes: string;
}

export interface ThemeSettings {
  accentColor: string;
  glowIntensity: number;
  compactMode: boolean;
}

export interface LauncherSettings {
  javaPath: string;
  defaultRamMb: number;
  gameDirectory: string;
  jvmArgs: string;
  launcherFolder: string;
}

export interface LauncherStatusSummary {
  version: string;
  javaDetected: boolean;
  storageReady: boolean;
  lastSync: string;
}
