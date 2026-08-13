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
  { id: "1.19.4", type: "release" },
  { id: "1.18.2", type: "release" },
  { id: "1.16.5", type: "release" },
  { id: "1.12.2", type: "release" },
  { id: "1.8.9", type: "release" },
  { id: "1.8", type: "release" },
  { id: "1.7.10", type: "release" },
  { id: "1.6.4", type: "release" }
];

export async function getMinecraftVersions(): Promise<MinecraftVersion[]> {
  try {
    const response = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
    if (!response.ok) return fallbackVersions;
    const manifest = (await response.json()) as { versions?: MinecraftVersion[] };
    const versions = manifest.versions?.filter((version) => ["release", "old_beta", "old_alpha"].includes(version.type)) ?? [];
    return versions.length > 0 ? versions : fallbackVersions;
  } catch {
    return fallbackVersions;
  }
}
