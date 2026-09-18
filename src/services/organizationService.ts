import { invoke, isTauri } from "@tauri-apps/api/core";
import { emptyOrganization, LibraryOrganization } from "../models/organization";
const key = "stellarlauncher.organization";
export async function loadOrganization(): Promise<LibraryOrganization> {
  if (isTauri()) return (await invoke<LibraryOrganization>("load_organization")) ?? emptyOrganization();
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : emptyOrganization();
}
export async function saveOrganization(organization: LibraryOrganization): Promise<void> {
  if (isTauri()) await invoke("save_organization", {organization});
  else localStorage.setItem(key, JSON.stringify(organization));
}
