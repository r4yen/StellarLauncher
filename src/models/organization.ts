export interface LibraryFolder { id: string; name: string }
export interface Placement { folderId?: string; order: number }
export interface CollectionOrganization { folders: LibraryFolder[]; placements: Record<string, Placement> }
export interface LibraryOrganization { accounts: CollectionOrganization; instances: CollectionOrganization }
export type CollectionKind = keyof LibraryOrganization;
export const emptyCollection = (): CollectionOrganization => ({ folders: [], placements: {} });
export const emptyOrganization = (): LibraryOrganization => ({ accounts: emptyCollection(), instances: emptyCollection() });

export function folderOf(collection: CollectionOrganization, id: string): string | undefined {
  const folder = collection.placements[id]?.folderId;
  return collection.folders.some(item => item.id === folder) ? folder : undefined;
}
export function orderedItems<T extends { id: string }>(items: T[], collection: CollectionOrganization, folder?: string): T[] {
  return items.filter(item => folderOf(collection, item.id) === folder).sort((a, b) =>
    (collection.placements[a.id]?.order ?? items.indexOf(a)) - (collection.placements[b.id]?.order ?? items.indexOf(b)));
}
export function moveLibraryItem(collection: CollectionOrganization, ids: string[], id: string, folderId?: string, beforeId?: string): CollectionOrganization {
  if (!ids.includes(id) || (folderId && !collection.folders.some(folder => folder.id === folderId)) || id === beforeId) return collection;
  const target = orderedItems(ids.map(id => ({id})), collection, folderId).map(item => item.id).filter(item => item !== id);
  const index = beforeId ? target.indexOf(beforeId) : -1;
  target.splice(index < 0 ? target.length : index, 0, id);
  const placements = {...collection.placements};
  target.forEach((item, order) => { placements[item] = {folderId, order}; });
  return {...collection, placements};
}
export function removeLibraryFolder(collection: CollectionOrganization, ids: string[], folderId: string): CollectionOrganization {
  let result = collection;
  for (const item of orderedItems(ids.map(id=>({id})), collection, folderId)) result = moveLibraryItem(result, ids, item.id);
  return {...result, folders: result.folders.filter(folder => folder.id !== folderId)};
}
