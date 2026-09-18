import { invoke } from "@tauri-apps/api/core";
import { trackedInvoke } from "./downloadOperations";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { Instance, LoaderType } from "../models/instance";
import { translateUi, UiLocale } from "../uiTranslation";

export interface MrpackPreview {
  name: string;
  versionId: string;
  summary?: string;
  minecraftVersion: string;
  loaderType: LoaderType;
  loaderVersion: string;
  optionalFiles: string[];
}

export interface MrpackSelection {
  path: string;
  pack: MrpackPreview;
}

export interface MrpackExportEntry {
  path: string;
  isDirectory: boolean;
}

export interface MrpackExportOptions {
  name: string;
  versionId: string;
  summary: string;
  includedPaths: string[];
}

export async function selectMrpack(language: UiLocale = "en"): Promise<MrpackSelection | undefined> {
  const path = await openDialog({ multiple: false, title: translateUi("Import Modrinth modpack", language), filters: [{ name: translateUi("Modrinth Modpack", language), extensions: ["mrpack"] }] });
  if (!path || Array.isArray(path)) return undefined;
  const pack = await invoke<MrpackPreview>("inspect_mrpack", { path });
  return { path, pack };
}

export async function importMrpack(selection: MrpackSelection, optionalFiles: string[], operationId: string): Promise<Instance[]> {
  return trackedInvoke(operationId,"import_mrpack", { path: selection.path, optionalFiles, operationId });
}

export async function listMrpackExportEntries(instance: Instance): Promise<MrpackExportEntry[]> {
  return invoke("list_mrpack_export_entries", { gameDirectory: instance.gameDirectory });
}

export async function exportMrpack(instance: Instance, options: MrpackExportOptions, language: UiLocale = "en"): Promise<string | undefined> {
  const path = await saveDialog({
    defaultPath: `${options.name.replace(/[<>:"/\\|?*]+/g, "-") || "Modpack"}.mrpack`,
    title: translateUi("Export Modrinth modpack", language),
    filters: [{ name: translateUi("Modrinth Modpack", language), extensions: ["mrpack"] }]
  });
  if (!path) return undefined;
  return invoke("export_mrpack", { path, instance, options });
}
