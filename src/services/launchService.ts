import { invoke } from "@tauri-apps/api/core";
import { LaunchStatus } from "../models/launcher";

interface LaunchResponse {
  state: LaunchStatus["state"];
  message: string;
  instance_id: string;
}

export async function requestMockLaunch(instanceId: string): Promise<LaunchStatus> {
  try {
    const response = await invoke<LaunchResponse>("start_mock_launch", { instanceId });
    return {
      state: response.state,
      message: response.message,
      instanceId: response.instance_id,
      updatedAt: new Date().toISOString()
    };
  } catch {
    return {
      state: "preparing",
      message: "Preparing local launch plan",
      instanceId,
      updatedAt: new Date().toISOString()
    };
  }
}
