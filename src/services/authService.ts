import { invoke } from "@tauri-apps/api/core";
import { DeviceLoginPollResult, DeviceLoginStart } from "../models/account";

const missingClientIdMessage =
  "Microsoft Client ID is missing. Set STELLAR_MICROSOFT_CLIENT_ID or replace the placeholder in the Rust auth module.";

export async function beginMicrosoftDeviceLogin(): Promise<DeviceLoginStart> {
  try {
    return await invoke<DeviceLoginStart>("begin_ms_device_login");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error || missingClientIdMessage));
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await invoke("open_external_url", { url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function pollMicrosoftDeviceLogin(sessionId: string): Promise<DeviceLoginPollResult> {
  try {
    return await invoke<DeviceLoginPollResult>("poll_ms_device_login", { sessionId });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error || "Login polling failed")
    };
  }
}

export async function refreshMinecraftAccount(accountId: string): Promise<DeviceLoginPollResult> {
  try {
    return await invoke<DeviceLoginPollResult>("refresh_minecraft_account", { accountId });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error || "Token refresh failed")
    };
  }
}
