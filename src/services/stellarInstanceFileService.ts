import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { CreateInstanceInput, Instance } from "../models/instance";
import { ModFile } from "../models/mod";
import { enrichModsWithModrinth } from "./modrinthService";
import { listMods } from "./modService";

export interface StellarInstanceModDownload {
  fileName: string;
  archiveFileName?: string;
  downloadUrl: string;
  enabled: boolean;
  sha1?: string;
  projectId?: string;
  versionId?: string;
}

export interface StellarInstanceImportResult {
  input: CreateInstanceInput;
  modDownloads: StellarInstanceModDownload[];
}

interface StellarInstanceReadResult {
  instance: Instance;
  modDownloads?: StellarInstanceModDownload[];
}

function instanceToInput(instance: Instance): CreateInstanceInput {
  return {
    name: instance.name,
    minecraftVersion: instance.minecraftVersion,
    loaderType: instance.loaderType,
    loaderVersion: instance.loaderVersion,
    gameDirectory: instance.gameDirectory,
    javaPath: instance.javaPath,
    ramMb: instance.ramMb,
    jvmArgs: instance.jvmArgs,
    icon: instance.icon,
    notes: instance.notes
  };
}

export async function importStellarInstanceFromFile(): Promise<StellarInstanceImportResult | undefined> {
  const selected = await openDialog({
    multiple: false,
    title: "Import Stellar instance",
    filters: [{ name: "Stellar Instance", extensions: ["stellarinstance"] }]
  });

  if (!selected || Array.isArray(selected)) return undefined;
  const result = await invoke<StellarInstanceReadResult>("read_stellar_instance_file", { path: selected });
  return {
    input: instanceToInput(result.instance),
    modDownloads: result.modDownloads ?? []
  };
}

async function buildModDownloads(instance: Instance, cachedMods?: ModFile[]): Promise<StellarInstanceModDownload[]> {
  const localMods = cachedMods?.length ? cachedMods : await listMods(instance);
  const needsEnrichment = localMods.some((mod) => !mod.modrinth?.currentDownloadUrl);
  const enrichedMods = needsEnrichment ? await enrichModsWithModrinth(localMods, instance) : localMods;

  return enrichedMods.flatMap((mod): StellarInstanceModDownload[] => {
    const match = mod.modrinth;
    const downloadUrl = match?.currentDownloadUrl;
    const fileName = match?.currentFileName;
    if (!match || !downloadUrl || !fileName) return [];

    return [
      {
        fileName,
        archiveFileName: mod.fileName,
        downloadUrl,
        enabled: mod.enabled,
        sha1: mod.sha1,
        projectId: match.projectId,
        versionId: match.versionId
      }
    ];
  });
}

export async function exportStellarInstanceToFile(instance: Instance, includedFolders: string[], cachedMods?: ModFile[]): Promise<string | undefined> {
  const defaultPath = `${instance.name.replace(/[<>:"/\\|?*]+/g, "-") || "StellarInstance"}.stellarinstance`;
  const selected = await saveDialog({
    defaultPath,
    title: "Export Stellar instance",
    filters: [{ name: "Stellar Instance", extensions: ["stellarinstance"] }]
  });

  if (!selected) return undefined;
  const modDownloads = includedFolders.includes("mods") ? await buildModDownloads(instance, cachedMods) : [];
  return invoke<string>("write_stellar_instance_file", { path: selected, instance, includedFolders, modDownloads });
}
