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

export async function validateLaunch(instance: Instance, account: Account | undefined, settings: LauncherSettings): Promise<LaunchStatus> {
  const canLaunchWithAccount = account?.type === "offline" || account?.loginStatus === "active";
  const effectiveJavaPath = instance.javaPath.trim() || settings.javaPath.trim();

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
      message: "Instance configuration is incomplete. Set a Java path in Settings or on the instance.",
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
      javaPath: instance.javaPath.trim() || settings.javaPath.trim()
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
