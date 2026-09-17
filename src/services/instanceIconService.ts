import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const LOCAL_FILE_PREFIX = "local-file:";
export const DEFAULT_INSTANCE_ICON = "/default-instance-block.svg";

export function localInstanceIcon(path: string): string {
  return `${LOCAL_FILE_PREFIX}${path}`;
}

export function resolveInstanceIconSrc(icon: string | undefined): string | undefined {
  if (!icon || isColorInstanceIcon(icon)) return DEFAULT_INSTANCE_ICON;
  if (icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://")) return icon;
  if (icon.startsWith(LOCAL_FILE_PREFIX)) return convertFileSrc(icon.slice(LOCAL_FILE_PREFIX.length));
  if (icon.startsWith("/")) return icon;
  return DEFAULT_INSTANCE_ICON;
}

export function isColorInstanceIcon(icon: string | undefined): boolean {
  return Boolean(icon && /^#[0-9a-f]{6}$/i.test(icon));
}

export async function copyInstanceIcon(sourcePath: string): Promise<string> {
  return invoke<string>("copy_instance_icon", { sourcePath });
}
