export interface ModFile {
  fileName: string;
  path: string;
  sha1: string;
  enabled: boolean;
  name: string;
  version: string;
  authors: string[];
  iconDataUrl?: string;
  modrinth?: ModrinthMatch;
}

export interface ModrinthMatch {
  projectId: string;
  versionId: string;
  title: string;
  iconUrl?: string;
  latestVersionId?: string;
  latestVersionName?: string;
  latestFileName?: string;
  latestDownloadUrl?: string;
  updateAvailable?: boolean;
}

export interface ModrinthSearchResult {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl?: string;
}

export interface ModrinthSearchPage {
  hits: ModrinthSearchResult[];
  limit: number;
  offset: number;
  totalHits: number;
}
