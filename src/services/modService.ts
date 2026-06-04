import { invoke } from "@tauri-apps/api/core";
import { Instance } from "../models/instance";
import { ModFile } from "../models/mod";

export async function listMods(instance: Instance): Promise<ModFile[]> {
  return invoke<ModFile[]>("list_mods", { gameDirectory: instance.gameDirectory });
}

export async function setModEnabled(path: string, enabled: boolean): Promise<ModFile> {
  return invoke<ModFile>("set_mod_enabled", { path, enabled });
}

export async function deleteMod(path: string): Promise<void> {
  await invoke("delete_mod", { path });
}

export async function addModFile(gameDirectory: string, sourcePath: string): Promise<ModFile> {
  return invoke<ModFile>("add_mod_file", { gameDirectory, sourcePath });
}
