export type SkinLibrarySource = "account" | "playerName";

export interface SkinLibraryItem {
  id: string;
  name: string;
  imageUrl: string;
  fullImageUrl?: string;
  source: SkinLibrarySource;
  accountId?: string;
  uuid?: string;
  isFavorite?: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}
