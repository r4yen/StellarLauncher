import type { Account } from "./account";

export type LoaderType = "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
export type InstanceStatus = "ready" | "incomplete" | "needsAccount" | "error";
export type LaunchState = "idle" | "preparing" | "downloading" | "launching" | "running" | "error";

export interface Instance {
  id: string;
  name: string;
  minecraftVersion: string;
  loaderType: LoaderType;
  loaderVersion: string;
  gameDirectory: string;
  javaPath: string;
  ramMb: number;
  jvmArgs: string;
  createdAt: string;
  lastPlayedAt?: string;
  playtimeSeconds?: number;
  status: InstanceStatus;
  icon: string;
  isFavorite?: boolean;
  order?: number;
  notes?: string;
}

export interface CreateInstanceInput {
  name: string;
  minecraftVersion: string;
  loaderType: LoaderType;
  loaderVersion: string;
  gameDirectory: string;
  javaPath: string;
  ramMb: number;
  jvmArgs: string;
  icon: string;
  notes?: string;
}

export interface LaunchStatus {
  state: LaunchState;
  message: string;
  instanceId?: string;
  updatedAt: string;
}

export interface RunningInstance {
  id: string;
  instance: Instance;
  account: Account;
  state: LaunchState;
  message: string;
  startedAt: string;
  updatedAt: string;
  logs: string[];
  processId?: number;
  logPath?: string;
}
