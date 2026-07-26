import { Instance } from "../models/instance";
import { LauncherSettings } from "../models/settings";
import { joinDisplayPath } from "../utils/path";
import { loadMinecraftCache, saveMinecraftCache } from "./storageService";

export function getMinecraftCacheKey(instance: Instance): string {
  return [instance.minecraftVersion, instance.loaderType, instance.loaderVersion || "native"].join(":");
}

export function getMinecraftLocalPath(instance: Instance, settings: LauncherSettings): string {
  const loaderSegment = instance.loaderType === "vanilla" ? "vanilla" : `${instance.loaderType}-${instance.loaderVersion}`;
  return joinDisplayPath(settings.minecraftStorageDirectory, "versions", instance.minecraftVersion, loaderSegment);
}

export async function loadLocalMinecraftCache(): Promise<string[]> {
  return loadMinecraftCache([]);
}

export async function saveLocalMinecraftCache(cacheKeys: string[]): Promise<string[]> {
  return saveMinecraftCache(cacheKeys);
}
