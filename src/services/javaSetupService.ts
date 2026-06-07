import { invoke } from "@tauri-apps/api/core";

export interface JavaSetupProgress {
  version: 8 | 17 | 21 | 25;
  status: "pending" | "downloading" | "extracting" | "completed" | "error";
  downloadedBytes: number;
  totalBytes?: number;
  targetPath: string;
  message: string;
}

export interface JavaSetupResult {
  java8Path: string;
  java17Path: string;
  java21Path: string;
  java25Path: string;
}

export async function setupAdoptiumJava(launcherFolder: string): Promise<JavaSetupResult> {
  return invoke<JavaSetupResult>("setup_adoptium_java", { launcherFolder });
}
