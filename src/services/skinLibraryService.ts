import { SkinLibraryItem } from "../models/skin";
import { loadSkinLibrary, saveSkinLibrary } from "./storageService";

function normalizePlayerName(name: string): string {
  return name.trim().slice(0, 16);
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, "") || "skin";
}

export function skinUrlForPlayerName(name: string): string {
  return `https://mc-heads.net/head/${encodeURIComponent(name)}/96`;
}

export function fullSkinUrlForPlayerName(name: string): string {
  return `https://mc-heads.net/body/${encodeURIComponent(name)}/128`;
}

function withFullSkinFallback(skin: SkinLibraryItem): SkinLibraryItem {
  if (skin.fullImageUrl) return skin;
  if (skin.source === "playerName") return { ...skin, fullImageUrl: fullSkinUrlForPlayerName(skin.name) };
  if (skin.uuid) return { ...skin, fullImageUrl: `https://mc-heads.net/body/${skin.uuid.replace(/-/g, "")}/128` };
  return { ...skin, fullImageUrl: skin.imageUrl };
}

function normalizeOrder(skins: SkinLibraryItem[]): SkinLibraryItem[] {
  let favoriteOrder = 0;
  let regularOrder = 0;
  return sortSkinLibrary(skins).map((skin) => {
    const nextSkin = withFullSkinFallback(skin);
    if (nextSkin.isFavorite) return { ...nextSkin, order: favoriteOrder++ };
    return { ...nextSkin, order: regularOrder++ };
  });
}

export function sortSkinLibrary(skins: SkinLibraryItem[]): SkinLibraryItem[] {
  return [...skins].sort((left, right) => {
    if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) return left.isFavorite ? -1 : 1;
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

export async function getSkinLibrary(fallback: SkinLibraryItem[]): Promise<SkinLibraryItem[]> {
  return normalizeOrder(
    (await loadSkinLibrary(fallback))
      .filter((skin) => skin.source !== "account" && !skin.id.startsWith("account:"))
      .map(withFullSkinFallback)
  );
}

export async function persistSkinLibrary(skins: SkinLibraryItem[]): Promise<SkinLibraryItem[]> {
  return saveSkinLibrary(normalizeOrder(skins));
}

export function addPlayerNameSkin(skins: SkinLibraryItem[], rawName: string): SkinLibraryItem[] {
  const name = normalizePlayerName(rawName);
  const now = new Date().toISOString();
  const id = `player:${slugify(name)}`;
  const sorted = sortSkinLibrary(skins);
  const existingIndex = sorted.findIndex((skin) => skin.id === id);
  const item: SkinLibraryItem = {
    id,
    name,
    imageUrl: skinUrlForPlayerName(name),
    fullImageUrl: fullSkinUrlForPlayerName(name),
    source: "playerName",
    isFavorite: existingIndex >= 0 ? sorted[existingIndex].isFavorite : false,
    order: existingIndex >= 0 ? sorted[existingIndex].order : sorted.length,
    createdAt: existingIndex >= 0 ? sorted[existingIndex].createdAt : now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    sorted[existingIndex] = item;
    return normalizeOrder(sorted);
  }

  return normalizeOrder([...sorted, item]);
}

export function removeSkin(skins: SkinLibraryItem[], skinId: string): SkinLibraryItem[] {
  return normalizeOrder(sortSkinLibrary(skins).filter((skin) => skin.id !== skinId));
}

export function toggleSkinFavorite(skins: SkinLibraryItem[], skinId: string): SkinLibraryItem[] {
  const nextFavorite = !skins.find((skin) => skin.id === skinId)?.isFavorite;
  const groupMaxOrder = Math.max(
    -1,
    ...skins
      .filter((skin) => Boolean(skin.isFavorite) === nextFavorite && skin.id !== skinId)
      .map((skin) => skin.order ?? 0)
  );
  return normalizeOrder(
    sortSkinLibrary(
      skins.map((skin) =>
        skin.id === skinId
          ? { ...skin, isFavorite: nextFavorite, order: groupMaxOrder + 1, updatedAt: new Date().toISOString() }
          : skin
      )
    )
  );
}

export function renameSkin(skins: SkinLibraryItem[], skinId: string, rawName: string): SkinLibraryItem[] {
  const name = rawName.trim();
  if (name.length < 1) return skins;

  return normalizeOrder(
    sortSkinLibrary(skins).map((skin) =>
      skin.id === skinId ? { ...skin, name, updatedAt: new Date().toISOString() } : skin
    )
  );
}

export function reorderSkin(skins: SkinLibraryItem[], draggedId: string, targetId: string): SkinLibraryItem[] {
  if (draggedId === targetId) return skins;
  const sorted = sortSkinLibrary(skins);
  const from = sorted.findIndex((skin) => skin.id === draggedId);
  const to = sorted.findIndex((skin) => skin.id === targetId);
  if (from < 0 || to < 0) return skins;

  const next = [...sorted];
  const [dragged] = next.splice(from, 1);
  next.splice(to, 0, dragged);
  return normalizeOrder(next);
}

export function moveSkin(skins: SkinLibraryItem[], skinId: string, direction: -1 | 1): SkinLibraryItem[] {
  const sorted = sortSkinLibrary(skins);
  const index = sorted.findIndex((skin) => skin.id === skinId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return skins;
  if (Boolean(sorted[index].isFavorite) !== Boolean(sorted[target].isFavorite)) return skins;

  const next = [...sorted];
  [next[index], next[target]] = [next[target], next[index]];
  return normalizeOrder(next);
}

export function canMoveSkin(skins: SkinLibraryItem[], skinId: string, direction: -1 | 1): boolean {
  const sorted = sortSkinLibrary(skins);
  const index = sorted.findIndex((skin) => skin.id === skinId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return false;
  return Boolean(sorted[index].isFavorite) === Boolean(sorted[target].isFavorite);
}
