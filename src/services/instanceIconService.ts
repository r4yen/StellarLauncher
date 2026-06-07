import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const LOCAL_FILE_PREFIX = "local-file:";

export function localInstanceIcon(path: string): string {
  return `${LOCAL_FILE_PREFIX}${path}`;
}

export function resolveInstanceIconSrc(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  if (icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://")) return icon;
  if (icon.startsWith(LOCAL_FILE_PREFIX)) return convertFileSrc(icon.slice(LOCAL_FILE_PREFIX.length));
  return undefined;
}

export function isColorInstanceIcon(icon: string | undefined): boolean {
  return Boolean(icon && /^#[0-9a-f]{6}$/i.test(icon));
}

export async function copyInstanceIcon(sourcePath: string): Promise<string> {
  return invoke<string>("copy_instance_icon", { sourcePath });
}
