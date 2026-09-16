import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileRepo, storageRepo } from "./db";
import { getMimeType } from "./streamer";
import type { MediaType } from "../types";

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".wmv", ".m4v", ".flv", ".ts"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"]);
const AUDIO_EXTS = new Set([".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".wma"]);
const DOC_EXTS = new Set([".pdf", ".txt", ".docx", ".xlsx", ".pptx", ".csv", ".md", ".json", ".zip", ".rar", ".7z", ".tar", ".gz", ".iso"]);

export function getMediaType(ext: string): MediaType {
  const lower = ext.toLowerCase();
  if (VIDEO_EXTS.has(lower)) return "video";
  if (IMAGE_EXTS.has(lower)) return "image";
  if (AUDIO_EXTS.has(lower)) return "audio";
  if (DOC_EXTS.has(lower)) return "document";
  return "other";
}

export function generateFileId(storageId: string, relativePath: string): string {
  return crypto.createHash("sha1").update(`${storageId}:${relativePath.toLowerCase()}`).digest("hex");
}

let isScanning = false;

export async function scanStorageRoot(rootId: string): Promise<{ indexed: number; removed: number }> {
  const root = storageRepo.getById(rootId);
  if (!root || !root.isActive) return { indexed: 0, removed: 0 };

  if (!fs.existsSync(root.path)) {
    console.warn(`[Scanner] Diretório não encontrado para o volume: ${root.path}`);
    return { indexed: 0, removed: 0 };
  }

  const existingFullPaths: string[] = [];
  let indexed = 0;

  function traverseDir(currentDir: string, relDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      console.error(`[Scanner] Erro ao ler pasta ${currentDir}:`, err);
      return;
    }

    for (const entry of entries) {
      // Skip hidden system files/folders like .git, $RECYCLE.BIN, etc.
      if (entry.name.startsWith(".") || entry.name.startsWith("$") || entry.name === "System Volume Information") {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.join(relDir, entry.name).replace(/\\/g, "/");
      const parentPath = relDir.replace(/\\/g, "/") || "/";

      existingFullPaths.push(fullPath);

      try {
        const stat = fs.statSync(fullPath);
        const isDir = entry.isDirectory();
        const ext = isDir ? "" : path.extname(entry.name).toLowerCase();
        const fileId = generateFileId(root.id, relativePath);

        fileRepo.upsert({
          id: fileId,
          storageId: root.id,
          relativePath,
          fullPath,
          name: entry.name,
          extension: ext,
          size: isDir ? 0 : stat.size,
          isDirectory: isDir,
          mediaType: isDir ? "other" : getMediaType(ext),
          mimeType: isDir ? "directory" : getMimeType(fullPath),
          parentPath,
          updatedAt: stat.mtimeMs,
        });

        indexed++;

        if (isDir) {
          traverseDir(fullPath, relativePath);
        }
      } catch (err) {
        console.error(`[Scanner] Erro ao processar arquivo ${fullPath}:`, err);
      }
    }
  }

  traverseDir(root.path, "");

  // Clean up deleted files
  fileRepo.deleteMissingPaths(root.id, existingFullPaths);

  return { indexed, removed: 0 };
}

export async function scanAllRoots(): Promise<{ totalIndexed: number }> {
  if (isScanning) {
    console.log("[Scanner] Varredura já em andamento...");
    return { totalIndexed: 0 };
  }

  isScanning = true;
  console.log("[Scanner] Iniciando varredura de todos os volumes...");
  let totalIndexed = 0;

  try {
    const roots = storageRepo.getAll();
    for (const root of roots) {
      if (root.isActive) {
        const result = await scanStorageRoot(root.id);
        totalIndexed += result.indexed;
      }
    }
    console.log(`[Scanner] Varredura concluída com sucesso. ${totalIndexed} itens catalogados.`);
  } finally {
    isScanning = false;
  }

  return { totalIndexed };
}
