export type MediaType = 'video' | 'image' | 'audio' | 'document' | 'other';

export interface StorageRoot {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  createdAt: number;
  totalSpace?: number;
  freeSpace?: number;
  fileCount?: number;
}

export interface FileItem {
  id: string;
  storageId: string;
  storageName?: string;
  relativePath: string;
  fullPath: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  mediaType: MediaType;
  mimeType: string;
  parentPath: string;
  duration?: number;
  width?: number;
  height?: number;
  updatedAt: number;
  hasCustomCover?: boolean;
  thumbnailUrl?: string;
  streamUrl?: string;
  downloadUrl?: string;
  watchProgress?: WatchProgress;
}

export interface WatchProgress {
  fileId: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: number;
  percentage?: number;
}

export interface MediaMetadata {
  fileId: string;
  title?: string;
  year?: number;
  genre?: string;
  customCoverPath?: string;
  rating?: number;
}

export interface CatalogCategory {
  id: string;
  title: string;
  description?: string;
  items: FileItem[];
}

export interface CatalogData {
  featured?: FileItem | null;
  continueWatching: FileItem[];
  categories: CatalogCategory[];
  totalMovies: number;
}

export interface SystemInfo {
  lanUrls: string[];
  os: string;
  platform: string;
  hostname: string;
  storageRoots: StorageRoot[];
  ffmpegAvailable: boolean;
  totalIndexedFiles: number;
  totalIndexedVideos: number;
}
