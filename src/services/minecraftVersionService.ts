export interface MinecraftVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  url?: string;
}

const fallbackVersions: MinecraftVersion[] = [
  { id: "1.21.5", type: "release" },
  { id: "1.21.4", type: "release" },
  { id: "1.21.1", type: "release" },
  { id: "1.20.6", type: "release" },
  { id: "1.20.1", type: "release" },
  { id: "1.19.4", type: "release" }
];

export async function getMinecraftVersions(): Promise<MinecraftVersion[]> {
  try {
    const response = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
    if (!response.ok) return fallbackVersions;
    const manifest = (await response.json()) as { versions?: MinecraftVersion[] };
    return manifest.versions?.filter((version) => version.type === "release").slice(0, 30) ?? fallbackVersions;
  } catch {
    return fallbackVersions;
  }
}
