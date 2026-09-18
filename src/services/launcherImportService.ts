import { invoke } from "@tauri-apps/api/core";
import { Instance } from "../models/instance";

export const importLaunchers = [
  { id: "modrinth", name: "Modrinth" },
  { id: "curseforge", name: "CurseForge" },
  { id: "prism", name: "Prism Launcher" },
  { id: "multimc", name: "MultiMC" },
  { id: "polymc", name: "PolyMC" },
  { id: "atlauncher", name: "ATLauncher" },
  { id: "gdlauncher", name: "GDLauncher (Legacy)" }
];
export interface ForeignInstance {
  id: string;
  name: string;
  gameDirectory: string;
  minecraftVersion: string;
  loaderType: string;
  loaderVersion: string;
  error?: string;
}
export interface LauncherScan { roots: string[]; instances: ForeignInstance[]; warnings: string[] }
export interface LauncherImportResult { instances: Instance[]; importedIds: string[]; errors: string[] }
export const scanLauncher = (launcher: string, root?: string) => invoke<LauncherScan>("scan_launcher_instances", { launcher, root: root ?? null });
export const importLauncher = (launcher: string, root: string | undefined, selectedIds: string[]) => invoke<LauncherImportResult>("import_launcher_instances", { launcher, root: root ?? null, selectedIds });
