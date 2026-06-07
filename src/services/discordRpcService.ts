import { invoke } from "@tauri-apps/api/core";
import { RunningInstance } from "../models/instance";
import { loaderLabels } from "./loaderServices";

interface DiscordRpcActivity {
  enabled: boolean;
  details: string;
  state?: string;
}

function instanceActivityTitle(runningInstance: RunningInstance): string {
  const { loaderType, minecraftVersion } = runningInstance.instance;
  if (loaderType === "vanilla") return `Minecraft ${minecraftVersion}`;

  return `Minecraft ${loaderLabels[loaderType]} ${minecraftVersion}`;
}

export function buildDiscordRpcActivity(runningInstances: RunningInstance[], enabled: boolean): DiscordRpcActivity {
  const activeRuns = runningInstances.filter((running) => running.state === "running" || running.state === "launching" || running.state === "downloading");

  if (!enabled) {
    return {
      enabled: false,
      details: "Stellar Launcher"
    };
  }

  if (activeRuns.length === 0) {
    return {
      enabled: true,
      details: "In the launcher"
    };
  }

  if (activeRuns.length === 1) {
    return {
      enabled: true,
      details: instanceActivityTitle(activeRuns[0])
    };
  }

  return {
    enabled: true,
    details: `Minecraft on ${activeRuns.length} instances`
  };
}

export async function updateDiscordRpc(activity: DiscordRpcActivity): Promise<void> {
  await invoke("update_discord_rpc", { activity });
}

export async function clearDiscordRpc(): Promise<void> {
  await invoke("clear_discord_rpc");
}
