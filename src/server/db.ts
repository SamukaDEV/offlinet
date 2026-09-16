import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import type { StorageRoot, FileItem, WatchProgress, MediaMetadata, Playlist } from "../types";

const DATA_DIR = path.resolve(process.cwd(), ".offlinet_data");
const CACHE_DIR = path.resolve(DATA_DIR, "cache");
const THUMB_DIR = path.resolve(CACHE_DIR, "thumbnails");

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "offlinet.db");
export const db = new Database(dbPath, { create: true });

// Optimize SQLite for LAN server workloads
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA synchronous = NORMAL;");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS storage_roots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    storage_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    full_path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    extension TEXT NOT NULL,
    size INTEGER NOT NULL,
    is_directory INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    parent_path TEXT NOT NULL,
    duration REAL DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (storage_id) REFERENCES storage_roots(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    file_id TEXT PRIMARY KEY,
    progress_seconds REAL NOT NULL,
    duration_seconds REAL NOT NULL,
    completed INTEGER DEFAULT 0,
    last_watched_at INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS media_metadata (
    file_id TEXT PRIMARY KEY,
    title TEXT,
    year INTEGER,
    genre TEXT,
    custom_cover_path TEXT,
    rating REAL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_files_storage ON files(storage_id);
  CREATE INDEX IF NOT EXISTS idx_files_media_type ON files(media_type);
  CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_path);
  CREATE INDEX IF NOT EXISTS idx_watch_history_time ON watch_history(last_watched_at);
  CREATE INDEX IF NOT EXISTS idx_playlist_items_pid ON playlist_items(playlist_id);
`);

export const DATA_PATHS = {
  dataDir: DATA_DIR,
  cacheDir: CACHE_DIR,
  thumbDir: THUMB_DIR,
};

// Storage Root queries
export const storageRepo = {
  getAll: (): StorageRoot[] => {
    const query = db.query(`
      SELECT 
        s.id, 
        s.name, 
        s.path, 
        s.is_active as isActive, 
        s.created_at as createdAt,
        (SELECT COUNT(*) FROM files f WHERE f.storage_id = s.id) as fileCount
      FROM storage_roots s
      ORDER BY s.created_at ASC
    `);
    const rows = query.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
      fileCount: r.fileCount,
    }));
  },

  getById: (id: string): StorageRoot | null => {
    const row = db.query(`SELECT * FROM storage_roots WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
  },

  add: (root: { id: string; name: string; path: string; isActive?: boolean }): StorageRoot => {
    const now = Date.now();
    const isActive = root.isActive !== undefined ? (root.isActive ? 1 : 0) : 1;
    db.run(
      `INSERT INTO storage_roots (id, name, path, is_active, created_at) VALUES (?, ?, ?, ?, ?)`,
      [root.id, root.name, root.path, isActive, now]
    );
    return {
      id: root.id,
      name: root.name,
      path: root.path,
      isActive: Boolean(isActive),
      createdAt: now,
    };
  },

  update: (id: string, updates: { name?: string; path?: string; isActive?: boolean }): boolean => {
    const current = storageRepo.getById(id);
    if (!current) return false;
    const name = updates.name !== undefined ? updates.name : current.name;
    const p = updates.path !== undefined ? updates.path : current.path;
    const active = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (current.isActive ? 1 : 0);
    db.run(
      `UPDATE storage_roots SET name = ?, path = ?, is_active = ? WHERE id = ?`,
      [name, p, active, id]
    );
    return true;
  },

  delete: (id: string): boolean => {
    db.run(`DELETE FROM storage_roots WHERE id = ?`, [id]);
    return true;
  },
};

// Files queries
export const fileRepo = {
  upsert: (file: {
    id: string;
    storageId: string;
    relativePath: string;
    fullPath: string;
    name: string;
    extension: string;
    size: number;
    isDirectory: boolean;
    mediaType: string;
    mimeType: string;
    parentPath: string;
    duration?: number;
    width?: number;
    height?: number;
    updatedAt: number;
  }) => {
    db.run(
      `INSERT INTO files (
        id, storage_id, relative_path, full_path, name, extension, size, 
        is_directory, media_type, mime_type, parent_path, duration, width, height, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(full_path) DO UPDATE SET
        name = excluded.name,
        extension = excluded.extension,
        size = excluded.size,
        media_type = excluded.media_type,
        mime_type = excluded.mime_type,
        updated_at = excluded.updated_at
      `,
      [
        file.id,
        file.storageId,
        file.relativePath,
        file.fullPath,
        file.name,
        file.extension,
        file.size,
        file.isDirectory ? 1 : 0,
        file.mediaType,
        file.mimeType,
        file.parentPath,
        file.duration || 0,
        file.width || 0,
        file.height || 0,
        file.updatedAt,
      ]
    );
  },

  getById: (id: string): FileItem | null => {
    const row = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM files f
      JOIN storage_roots s ON f.storage_id = s.id
      LEFT JOIN watch_history w ON f.id = w.file_id
      WHERE f.id = ?
    `).get(id) as any;

    if (!row) return null;
    return mapDbRowToFileItem(row);
  },

  getByFullPath: (fullPath: string): FileItem | null => {
    const row = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM files f
      JOIN storage_roots s ON f.storage_id = s.id
      LEFT JOIN watch_history w ON f.id = w.file_id
      WHERE f.full_path = ?
    `).get(fullPath) as any;

    if (!row) return null;
    return mapDbRowToFileItem(row);
  },

  listByFolder: (storageId: string, parentPath: string): FileItem[] => {
    const rows = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM files f
      JOIN storage_roots s ON f.storage_id = s.id
      LEFT JOIN watch_history w ON f.id = w.file_id
      WHERE f.storage_id = ? AND f.parent_path = ?
      ORDER BY f.is_directory DESC, f.name ASC
    `).all(storageId, parentPath) as any[];

    return rows.map(mapDbRowToFileItem);
  },

  listFolders: (storageId: string): { relativePath: string; name: string }[] => {
    const rows = db.query(`
      SELECT relative_path, name
      FROM files
      WHERE storage_id = ? AND is_directory = 1
      ORDER BY relative_path ASC
    `).all(storageId) as any[];

    return [
      { relativePath: "/", name: "Raiz do Disco" },
      ...rows.map((r) => ({
        relativePath: r.relative_path,
        name: r.name,
      })),
    ];
  },

  listMediaVideos: (limit = 100): FileItem[] => {
    const rows = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM files f
      JOIN storage_roots s ON f.storage_id = s.id
      LEFT JOIN watch_history w ON f.id = w.file_id
      WHERE f.media_type = 'video' AND f.is_directory = 0 AND s.is_active = 1
      ORDER BY f.updated_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(mapDbRowToFileItem);
  },

  listContinueWatching: (limit = 20): FileItem[] => {
    const rows = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM watch_history w
      JOIN files f ON w.file_id = f.id
      JOIN storage_roots s ON f.storage_id = s.id
      WHERE w.completed = 0 AND w.progress_seconds > 5 AND s.is_active = 1
      ORDER BY w.last_watched_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(mapDbRowToFileItem);
  },

  deleteByStorage: (storageId: string) => {
    db.run(`DELETE FROM files WHERE storage_id = ?`, [storageId]);
  },

  deleteMissingPaths: (storageId: string, existingPaths: string[]) => {
    if (existingPaths.length === 0) {
      db.run(`DELETE FROM files WHERE storage_id = ?`, [storageId]);
      return;
    }

    const existingSet = new Set(existingPaths);
    const dbRows = db.query(`SELECT id, full_path FROM files WHERE storage_id = ?`).all(storageId) as {
      id: string;
      full_path: string;
    }[];

    const idsToDelete: string[] = [];
    for (const row of dbRows) {
      if (!existingSet.has(row.full_path)) {
        idsToDelete.push(row.id);
      }
    }

    if (idsToDelete.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
        const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "?").join(",");
        db.run(`DELETE FROM files WHERE id IN (${placeholders})`, chunk);
      }
    }
  },

  deleteFile: (id: string) => {
    db.run(`DELETE FROM files WHERE id = ?`, [id]);
  },

  updateMetadata: (id: string, metadata: { duration?: number; width?: number; height?: number }) => {
    db.run(
      `UPDATE files SET 
         duration = CASE WHEN ? IS NOT NULL THEN ? ELSE duration END,
         width = CASE WHEN ? IS NOT NULL THEN ? ELSE width END,
         height = CASE WHEN ? IS NOT NULL THEN ? ELSE height END
       WHERE id = ?`,
      [
        metadata.duration ?? null, metadata.duration ?? null,
        metadata.width ?? null, metadata.width ?? null,
        metadata.height ?? null, metadata.height ?? null,
        id
      ]
    );
  },

  getStats: () => {
    const totalFiles = (db.query(`SELECT COUNT(*) as count FROM files WHERE is_directory = 0`).get() as any)?.count || 0;
    const totalVideos = (db.query(`SELECT COUNT(*) as count FROM files WHERE media_type = 'video' AND is_directory = 0`).get() as any)?.count || 0;
    return { totalFiles, totalVideos };
  }
};

// Watch progress queries
export const watchRepo = {
  saveProgress: (fileId: string, progressSeconds: number, durationSeconds: number) => {
    const completed = durationSeconds > 0 && progressSeconds / durationSeconds > 0.92 ? 1 : 0;
    const now = Date.now();
    db.run(
      `INSERT INTO watch_history (file_id, progress_seconds, duration_seconds, completed, last_watched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET
         progress_seconds = excluded.progress_seconds,
         duration_seconds = excluded.duration_seconds,
         completed = excluded.completed,
         last_watched_at = excluded.last_watched_at`,
      [fileId, progressSeconds, durationSeconds, completed, now]
    );
  },

  clearProgress: (fileId: string) => {
    db.run(`DELETE FROM watch_history WHERE file_id = ?`, [fileId]);
  },
};

// Playlists queries
export const playlistRepo = {
  getAll: (): Playlist[] => {
    const rows = db.query(`
      SELECT 
        p.id, 
        p.name, 
        p.created_at as createdAt,
        (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) as itemCount
      FROM playlists p
      ORDER BY p.created_at DESC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      itemCount: r.itemCount || 0,
    }));
  },

  getById: (id: string): Playlist | null => {
    const p = db.query(`SELECT id, name, created_at as createdAt FROM playlists WHERE id = ?`).get(id) as any;
    if (!p) return null;

    const itemRows = db.query(`
      SELECT 
        f.*, 
        s.name as storage_name,
        w.progress_seconds,
        w.duration_seconds as watch_duration,
        w.completed as watch_completed,
        w.last_watched_at
      FROM playlist_items pi
      JOIN files f ON pi.file_id = f.id
      JOIN storage_roots s ON f.storage_id = s.id
      LEFT JOIN watch_history w ON f.id = w.file_id
      WHERE pi.playlist_id = ?
      ORDER BY pi.position ASC, pi.added_at ASC
    `).all(id) as any[];

    const items = itemRows.map(mapDbRowToFileItem);

    return {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      itemCount: items.length,
      items,
    };
  },

  create: (name: string): Playlist => {
    const id = "pl_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    db.run(`INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)`, [id, name, now]);
    return {
      id,
      name,
      createdAt: now,
      itemCount: 0,
      items: [],
    };
  },

  delete: (id: string): boolean => {
    db.run(`DELETE FROM playlists WHERE id = ?`, [id]);
    return true;
  },

  addItem: (playlistId: string, fileId: string): boolean => {
    const existing = db.query(`SELECT id FROM playlist_items WHERE playlist_id = ? AND file_id = ?`).get(playlistId, fileId);
    if (existing) return true;

    const maxPosRow = db.query(`SELECT MAX(position) as maxPos FROM playlist_items WHERE playlist_id = ?`).get(playlistId) as any;
    const nextPos = (maxPosRow?.maxPos ?? -1) + 1;
    const itemId = "pli_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

    db.run(
      `INSERT INTO playlist_items (id, playlist_id, file_id, position, added_at) VALUES (?, ?, ?, ?, ?)`,
      [itemId, playlistId, fileId, nextPos, Date.now()]
    );
    return true;
  },

  removeItem: (playlistId: string, fileId: string): boolean => {
    db.run(`DELETE FROM playlist_items WHERE playlist_id = ? AND file_id = ?`, [playlistId, fileId]);
    return true;
  },
};

function mapDbRowToFileItem(row: any): FileItem {
  const watchProgress: WatchProgress | undefined = row.progress_seconds !== null && row.progress_seconds !== undefined ? {
    fileId: row.id,
    progressSeconds: row.progress_seconds,
    durationSeconds: row.watch_duration || row.duration || 0,
    completed: Boolean(row.watch_completed),
    lastWatchedAt: row.last_watched_at,
    percentage: (row.watch_duration && row.watch_duration > 0)
      ? Math.min(100, Math.round((row.progress_seconds / row.watch_duration) * 100))
      : 0,
  } : undefined;

  return {
    id: row.id,
    storageId: row.storage_id,
    storageName: row.storage_name,
    relativePath: row.relative_path,
    fullPath: row.full_path,
    name: row.name,
    extension: row.extension,
    size: row.size,
    isDirectory: Boolean(row.is_directory),
    mediaType: row.media_type,
    mimeType: row.mime_type,
    parentPath: row.parent_path,
    duration: row.duration,
    width: row.width,
    height: row.height,
    updatedAt: row.updated_at,
    thumbnailUrl: `/api/thumbnail/${row.id}`,
    streamUrl: `/api/stream/${row.id}`,
    downloadUrl: `/api/files/download/${row.id}`,
    watchProgress,
  };
}
