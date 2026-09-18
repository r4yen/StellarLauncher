import { invoke, isTauri } from "@tauri-apps/api/core";
import { Account } from "../models/account";
import { Instance, RunningInstance } from "../models/instance";
import { LauncherSettings, ThemeSettings } from "../models/settings";
import { SkinLibraryItem } from "../models/skin";

type StorageKey = "accounts" | "instances" | "settings" | "theme" | "minecraftCache" | "runningInstances" | "skinLibrary";

const fallbackPrefix = "stellarlauncher.";

async function invokeOrFallback<T>(command: string, args: Record<string, unknown>, fallback: () => T): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch {
    return fallback();
  }
}

function readLocal<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${fallbackPrefix}${key}`);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function readLocalArray<T>(key: StorageKey, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(`${fallbackPrefix}${key}`);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: StorageKey, value: T): T {
  localStorage.setItem(`${fallbackPrefix}${key}`, JSON.stringify(value));
  return value;
}

export async function loadAccounts(fallback: Account[]): Promise<Account[]> {
  return invokeOrFallback<Account[]>("load_accounts", {}, () => readLocalArray("accounts", fallback));
}

export async function saveAccounts(accounts: Account[]): Promise<Account[]> {
  return invokeOrFallback<Account[]>("save_accounts", { accounts }, () => writeLocal("accounts", accounts));
}

export async function loadSkinLibrary(fallback: SkinLibraryItem[]): Promise<SkinLibraryItem[]> {
  return invokeOrFallback<SkinLibraryItem[]>("load_skin_library", {}, () => readLocalArray("skinLibrary", fallback));
}

export async function saveSkinLibrary(skins: SkinLibraryItem[]): Promise<SkinLibraryItem[]> {
  return invokeOrFallback<SkinLibraryItem[]>("save_skin_library", { skins }, () => writeLocal("skinLibrary", skins));
}

export async function loadInstances(fallback: Instance[]): Promise<Instance[]> {
  return invokeOrFallback<Instance[]>("load_instances", {}, () => readLocalArray("instances", fallback));
}

export async function saveInstances(instances: Instance[]): Promise<Instance[]> {
  if (isTauri()) return invoke<Instance[]>("save_instances", { instances });
  return invokeOrFallback<Instance[]>("save_instances", { instances }, () => writeLocal("instances", instances));
}

export async function loadSettings(fallback: LauncherSettings): Promise<LauncherSettings> {
  if (isTauri()) return invoke<LauncherSettings>("load_settings");
  const existing = localStorage.getItem(`${fallbackPrefix}settings`);
  return readLocal("settings", existing ? { ...fallback, initialSetupCompleted: true } : fallback);
}

export async function saveSettings(settings: LauncherSettings): Promise<LauncherSettings> {
  if (isTauri()) return invoke<LauncherSettings>("save_settings", { settings });
  return invokeOrFallback<LauncherSettings>("save_settings", { settings }, () => writeLocal("settings", settings));
}

export async function renameGameDirectory(expectedDirectory: string, newName: string): Promise<{ settings: LauncherSettings; instances: Instance[] }> {
  return invoke("rename_game_directory", { expectedDirectory, newName });
}

export async function loadTheme(fallback: ThemeSettings): Promise<ThemeSettings> {
  return invokeOrFallback<ThemeSettings>("load_theme", {}, () => readLocal("theme", fallback));
}

export async function saveTheme(theme: ThemeSettings): Promise<ThemeSettings> {
  return invokeOrFallback<ThemeSettings>("save_theme", { theme }, () => writeLocal("theme", theme));
}

export async function loadMinecraftCache(fallback: string[]): Promise<string[]> {
  return invokeOrFallback<string[]>("load_minecraft_cache", {}, () => readLocalArray("minecraftCache", fallback));
}

export async function saveMinecraftCache(cacheKeys: string[]): Promise<string[]> {
  return invokeOrFallback<string[]>("save_minecraft_cache", { cacheKeys }, () => writeLocal("minecraftCache", cacheKeys));
}

export function loadRunningInstancesLocal(): RunningInstance[] {
  return readLocalArray("runningInstances", []);
}

export function saveRunningInstancesLocal(runningInstances: RunningInstance[]): RunningInstance[] {
  return writeLocal("runningInstances", runningInstances.map((running) => ({ ...running, logs: running.logs.slice(-180) })));
}
