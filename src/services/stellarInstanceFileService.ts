import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { CreateInstanceInput, Instance } from "../models/instance";

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

export async function importStellarInstanceFromFile(): Promise<CreateInstanceInput | undefined> {
  const selected = await openDialog({
    multiple: false,
    title: "Import Stellar instance",
    filters: [{ name: "Stellar Instance", extensions: ["stellarinstance"] }]
  });

  if (!selected || Array.isArray(selected)) return undefined;
  const instance = await invoke<Instance>("read_stellar_instance_file", { path: selected });
  return instanceToInput(instance);
}

export async function exportStellarInstanceToFile(instance: Instance): Promise<string | undefined> {
  const defaultPath = `${instance.name.replace(/[<>:"/\\|?*]+/g, "-") || "StellarInstance"}.stellarinstance`;
  const selected = await saveDialog({
    defaultPath,
    title: "Export Stellar instance",
    filters: [{ name: "Stellar Instance", extensions: ["stellarinstance"] }]
  });

  if (!selected) return undefined;
  return invoke<string>("write_stellar_instance_file", { path: selected, instance });
}
