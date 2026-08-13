import { LoaderType } from "../models/instance";

export interface LoaderVersion {
  id: string;
  stable: boolean;
}

const loaderFallbacks: Record<Exclude<LoaderType, "vanilla">, LoaderVersion[]> = {
  fabric: [
    { id: "0.19.3", stable: true },
    { id: "0.19.2", stable: false },
    { id: "0.18.6", stable: false },
    { id: "0.17.3", stable: false },
    { id: "0.16.14", stable: false }
  ],
  forge: [
    { id: "61.1.8", stable: true },
    { id: "55.0.26", stable: true },
    { id: "47.4.12", stable: true },
    { id: "36.2.42", stable: true },
    { id: "14.23.5.2860", stable: true },
    { id: "12.18.3.2511", stable: true },
    { id: "11.15.1.2318", stable: true },
    { id: "11.14.4.1577", stable: true },
    { id: "10.13.4.1614", stable: true }
  ],
  neoforge: [
    { id: "26.1.2.71", stable: true },
    { id: "21.1.172", stable: true },
    { id: "20.6.122", stable: true }
  ],
  quilt: [
    { id: "0.30.0-beta.7", stable: false },
    { id: "0.29.2", stable: true },
    { id: "0.28.1", stable: true }
  ]
};

const FABRIC_LOADER_URL = "https://meta.fabricmc.net/v2/versions/loader";
const QUILT_LOADER_URL = "https://meta.quiltmc.org/v3/versions/loader";
const FORGE_METADATA_URL = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
const NEOFORGE_METADATA_URL = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";

interface MetaLoaderVersion {
  version?: string;
  stable?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function uniqueVersions(versions: LoaderVersion[]): LoaderVersion[] {
  const seen = new Set<string>();
  return versions
    .filter((version) => {
      if (!version.id || seen.has(version.id)) return false;
      seen.add(version.id);
      return true;
    });
}

function fromMetaVersions(versions: MetaLoaderVersion[], stableFallback: (version: string) => boolean): LoaderVersion[] {
  return uniqueVersions(
    versions
      .map((version) => ({
        id: version.version ?? "",
        stable: version.stable ?? stableFallback(version.version ?? "")
      }))
      .filter((version) => version.id.length > 0)
  );
}

function parseMavenVersions(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.querySelectorAll("version"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);
}

function fromMavenVersions(versions: string[]): LoaderVersion[] {
  return uniqueVersions(
    [...versions]
      .map((version) => ({
        id: version,
        stable: !/alpha|beta|rc|snapshot/i.test(version)
      }))
  );
}

function forgeLoaderVersionsForMinecraft(versions: string[], minecraftVersion?: string): LoaderVersion[] {
  if (!minecraftVersion) return fromMavenVersions(versions);

  const prefix = `${minecraftVersion}-`;
  const matching = versions.filter((version) => version.startsWith(prefix)).map((version) => version.slice(prefix.length));
  if (matching.length > 0) return fromMavenVersions(matching);

  const fallbackByMinecraftVersion: Record<string, LoaderVersion[]> = {
    "1.16.5": [{ id: "36.2.42", stable: true }],
    "1.12.2": [{ id: "14.23.5.2860", stable: true }],
    "1.10.2": [{ id: "12.18.3.2511", stable: true }],
    "1.8.9": [{ id: "11.15.1.2318-1.8.9", stable: true }],
    "1.8": [{ id: "11.14.4.1577", stable: true }],
    "1.7.10": [{ id: "10.13.4.1614-1.7.10", stable: true }]
  };

  return fallbackByMinecraftVersion[minecraftVersion] ?? fromMavenVersions(versions);
}

export class FabricService {
  static async getLoaderVersions(): Promise<LoaderVersion[]> {
    try {
      return fromMetaVersions(await fetchJson<MetaLoaderVersion[]>(FABRIC_LOADER_URL), () => false);
    } catch {
      return loaderFallbacks.fabric;
    }
  }
}

export class ForgeService {
  static async getLoaderVersions(minecraftVersion?: string): Promise<LoaderVersion[]> {
    try {
      return forgeLoaderVersionsForMinecraft(parseMavenVersions(await fetchText(FORGE_METADATA_URL)), minecraftVersion);
    } catch {
      return loaderFallbacks.forge;
    }
  }
}

export class NeoForgeService {
  static async getLoaderVersions(): Promise<LoaderVersion[]> {
    try {
      return fromMavenVersions(parseMavenVersions(await fetchText(NEOFORGE_METADATA_URL)));
    } catch {
      return loaderFallbacks.neoforge;
    }
  }
}

export class QuiltService {
  static async getLoaderVersions(): Promise<LoaderVersion[]> {
    try {
      return fromMetaVersions(await fetchJson<MetaLoaderVersion[]>(QUILT_LOADER_URL), (version) => !/beta|alpha|rc/i.test(version));
    } catch {
      return loaderFallbacks.quilt;
    }
  }
}

export async function getLoaderVersions(loaderType: LoaderType, minecraftVersion?: string): Promise<LoaderVersion[]> {
  if (loaderType === "vanilla") return [];
  if (loaderType === "fabric") return FabricService.getLoaderVersions();
  if (loaderType === "forge") return ForgeService.getLoaderVersions(minecraftVersion);
  if (loaderType === "neoforge") return NeoForgeService.getLoaderVersions();
  return QuiltService.getLoaderVersions();
}

export const loaderLabels: Record<LoaderType, string> = {
  vanilla: "Vanilla",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
  quilt: "Quilt"
};
