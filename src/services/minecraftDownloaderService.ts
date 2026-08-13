import { invoke } from "@tauri-apps/api/core";
import { Instance } from "../models/instance";
import { LauncherSettings } from "../models/settings";

export interface EnsureMinecraftFilesResult {
  versionId: string;
  filesDownloaded: number;
  bytesDownloaded: number;
  storagePath: string;
}

export interface MinecraftDownloadProgress {
  instanceId: string;
  instanceName: string;
  status: "downloading" | "completed" | "error";
  downloadedBytes: number;
  totalBytes?: number;
  fileName: string;
  targetPath: string;
}

export async function ensureMinecraftFiles(instance: Instance, settings: LauncherSettings): Promise<EnsureMinecraftFilesResult> {
  return invoke<EnsureMinecraftFilesResult>("ensure_minecraft_files", {
    request: {
      instance,
      minecraftStorageDirectory: settings.minecraftStorageDirectory
    }
  });
}
