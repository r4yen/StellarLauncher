import { invoke } from "@tauri-apps/api/core";
import { Account } from "../models/account";
import { Instance, LaunchStatus } from "../models/instance";
import { LauncherSettings } from "../models/settings";

interface ProcessLaunchResponse {
  state: LaunchStatus["state"];
  message: string;
  instanceId: string;
  processId: number;
  logPath: string;
}

export interface ProcessLaunchResult extends LaunchStatus {
  processId?: number;
  logPath?: string;
}

function parseMinecraftVersion(version: string): number[] {
  const match = version.match(/\d+(?:\.\d+)*/);
  return match ? match[0].split(".").map((part) => Number(part)) : [];
}

function isMinecraftVersionAtLeast(version: string, minimum: string): boolean {
  const currentParts = parseMinecraftVersion(version);
  const minimumParts = parseMinecraftVersion(minimum);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const current = currentParts[index] ?? 0;
    const required = minimumParts[index] ?? 0;
    if (current > required) return true;
    if (current < required) return false;
  }

  return true;
}

function selectJavaPath(instance: Instance, settings: LauncherSettings): string {
  const override = instance.javaPath.trim();
  if (override) return override;

  if (isMinecraftVersionAtLeast(instance.minecraftVersion, "26")) return settings.java25Path.trim();
  if (isMinecraftVersionAtLeast(instance.minecraftVersion, "1.20.5")) return settings.java21Path.trim();
  if (isMinecraftVersionAtLeast(instance.minecraftVersion, "1.17")) return settings.java17Path.trim();
  return settings.java8Path.trim();
}

export async function validateLaunch(instance: Instance, account: Account | undefined, settings: LauncherSettings): Promise<LaunchStatus> {
  const canLaunchWithAccount = account?.type === "offline" || account?.loginStatus === "active";
  const effectiveJavaPath = selectJavaPath(instance, settings);

  if (!account || !canLaunchWithAccount) {
    return {
      state: "error",
      message: "Select a Microsoft account or an offline player before launching.",
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    };
  }

  if (!instance.minecraftVersion || !instance.gameDirectory || !effectiveJavaPath) {
    return {
      state: "error",
      message: "Instance configuration is incomplete. Set the matching Java 8, 17, 21, or 25 path in Settings, or set a Java override on the instance.",
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    state: "preparing",
    message: "Launch prerequisites validated.",
    instanceId: instance.id,
    updatedAt: new Date().toISOString()
  };
}

export async function startMinecraftProcess(instance: Instance, account: Account, settings: LauncherSettings): Promise<ProcessLaunchResult> {
  try {
    const effectiveInstance = {
      ...instance,
      javaPath: selectJavaPath(instance, settings)
    };
    const response = await invoke<ProcessLaunchResponse>("start_minecraft_process", {
      request: {
        instance: effectiveInstance,
        account,
        minecraftStorageDirectory: settings.minecraftStorageDirectory
      }
    });

    return {
      state: response.state,
      message: response.message,
      instanceId: response.instanceId,
      processId: response.processId,
      logPath: response.logPath,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      state: "error",
      message: error instanceof Error ? error.message : String(error),
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    };
  }
}

export async function stopMinecraftProcess(processId: number): Promise<void> {
  await invoke("stop_minecraft_process", { processId });
}

export async function isMinecraftProcessRunning(processId: number): Promise<boolean> {
  return invoke<boolean>("is_minecraft_process_running", { processId });
}

export async function readLaunchLogTail(path: string, maxLines = 160): Promise<string[]> {
  return invoke<string[]>("read_launch_log_tail", { path, maxLines });
}
