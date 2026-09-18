import { Instance, LoaderType } from "../models/instance";
import { ModFile, ModrinthMatch, ModrinthSearchPage } from "../models/mod";

const MODRINTH_API = "https://api.modrinth.com/v2";

interface ModrinthVersionFile {
  filename: string;
  url: string;
  primary?: boolean;
  hashes: {
    sha1?: string;
  };
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  date_published: string;
  files: ModrinthVersionFile[];
}

interface ModrinthProject {
  id: string;
  title: string;
  icon_url?: string;
}

interface ModrinthSearchResponse {
  hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    description: string;
    author: string;
    downloads: number;
    icon_url?: string;
  }>;
  limit: number;
  offset: number;
  total_hits: number;
}

function loaderFacet(loaderType: LoaderType): string {
  return loaderType === "vanilla" ? "fabric" : loaderType;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "StellarLauncher/1.0.4"
    }
  });

  if (!response.ok) {
    throw new Error(`Modrinth request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getProjectVersions(projectId: string, instance: Instance): Promise<ModrinthVersion[]> {
  const params = new URLSearchParams({
    game_versions: JSON.stringify([instance.minecraftVersion]),
    loaders: JSON.stringify([loaderFacet(instance.loaderType)])
  });
  return fetchJson<ModrinthVersion[]>(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params.toString()}`);
}

export function primaryJarFile(version: ModrinthVersion): ModrinthVersionFile | undefined {
  return version.files.find((file) => file.primary && file.filename.endsWith(".jar")) ?? version.files.find((file) => file.filename.endsWith(".jar"));
}

export async function findModrinthMatch(mod: ModFile, instance: Instance): Promise<ModrinthMatch | undefined> {
  if (!mod.sha1) return undefined;

  let currentVersion: ModrinthVersion;
  try {
    currentVersion = await fetchJson<ModrinthVersion>(`${MODRINTH_API}/version_file/${mod.sha1}?algorithm=sha1`);
  } catch {
    return undefined;
  }

  const [project, versions] = await Promise.all([
    fetchJson<ModrinthProject>(`${MODRINTH_API}/project/${encodeURIComponent(currentVersion.project_id)}`),
    getProjectVersions(currentVersion.project_id, instance)
  ]);
  const currentFile = primaryJarFile(currentVersion);
  const latestVersion = versions[0];
  const latestFile = latestVersion ? primaryJarFile(latestVersion) : undefined;

  return {
    projectId: currentVersion.project_id,
    versionId: currentVersion.id,
    title: project.title,
    iconUrl: project.icon_url,
    currentFileName: currentFile?.filename,
    currentDownloadUrl: currentFile?.url,
    latestVersionId: latestVersion?.id,
    latestVersionName: latestVersion?.version_number ?? latestVersion?.name,
    latestFileName: latestFile?.filename,
    latestDownloadUrl: latestFile?.url,
    updateAvailable: Boolean(latestVersion && latestVersion.id !== currentVersion.id && latestFile?.url)
  };
}

export async function enrichModsWithModrinth(mods: ModFile[], instance: Instance): Promise<ModFile[]> {
  const enriched = await Promise.all(
    mods.map(async (mod) => ({
      ...mod,
      modrinth: await findModrinthMatch(mod, instance)
    }))
  );
  return enriched;
}

export async function searchModrinthMods(query: string, instance: Instance, offset = 0, limit = 12): Promise<ModrinthSearchPage> {
  const facets = [
    ["project_type:mod"],
    [`versions:${instance.minecraftVersion}`],
    [`categories:${loaderFacet(instance.loaderType)}`]
  ];
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    offset: String(offset),
    facets: JSON.stringify(facets)
  });
  const response = await fetchJson<ModrinthSearchResponse>(`${MODRINTH_API}/search?${params.toString()}`);
  return {
    hits: response.hits.map((hit) => ({
      projectId: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      author: hit.author,
      downloads: hit.downloads,
      iconUrl: hit.icon_url
    })),
    limit: response.limit,
    offset: response.offset,
    totalHits: response.total_hits
  };
}
